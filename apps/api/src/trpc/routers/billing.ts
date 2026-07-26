import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { t, protectedProcedure } from '../trpc.js';
import { getStripe } from '../../lib/stripe.js';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const PRICE_IDS: Readonly<Record<string, string>> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID ?? '',
  pro: process.env.STRIPE_PRO_PRICE_ID ?? '',
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '',
};

export const billingRouter = t.router({
  createCheckout: protectedProcedure
    .input(
      z.object({
        plan: z.enum(['starter', 'pro', 'enterprise']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { email: true, stripeCustomerId: true },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      }

      const priceId = PRICE_IDS[input.plan];
      if (!priceId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid plan selected.',
        });
      }

      let customerId = user.stripeCustomerId;

      if (!customerId) {
        const customer = await getStripe().customers.create({
          email: user.email ?? undefined,
          metadata: { userId: ctx.userId },
        });
        customerId = customer.id;

        await ctx.db.user.update({
          where: { id: ctx.userId },
          data: { stripeCustomerId: customerId },
        });
      }

      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_URL}/billing?canceled=true`,
        metadata: {
          userId: ctx.userId,
          plan: input.plan,
        },
        subscription_data: {
          metadata: {
            userId: ctx.userId,
            plan: input.plan,
          },
        },
      });

      if (!session.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create checkout session.',
        });
      }

      return { url: session.url };
    }),

  createPortal: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No billing account found. Please subscribe first.',
      });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${APP_URL}/billing`,
    });

    return { url: session.url };
  }),

  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
    }

    if (!user.stripeSubscriptionId) {
      return {
        plan: user.plan,
        status: 'none' as const,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    try {
      const subscription = await getStripe().subscriptions.retrieve(
        user.stripeSubscriptionId,
      );

      return {
        plan: user.plan,
        status: subscription.status,
        currentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    } catch {
      return {
        plan: user.plan,
        status: 'error' as const,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }
  }),
});

export { STRIPE_WEBHOOK_SECRET };
