import Stripe from 'stripe';
import { TRPCError } from '@trpc/server';

const STRIPE_API_VERSION = '2025-02-24.acacia';

let client: Stripe | null = null;

/**
 * Stripe is resolved lazily. Instantiating it at module load crashes the whole
 * API process when STRIPE_SECRET_KEY is absent, which is the normal case for
 * local development without billing configured.
 */
export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        'Billing is not configured on this server (missing STRIPE_SECRET_KEY).',
    });
  }

  if (client === null) {
    client = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  }

  return client;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
