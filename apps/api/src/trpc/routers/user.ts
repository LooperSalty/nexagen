import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { t, publicProcedure, protectedProcedure } from '../trpc.js';

export const userRouter = t.router({
  getProfile: publicProcedure
    .input(z.object({ username: z.string().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { username: input.username },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          createdAt: true,
          _count: {
            select: {
              worlds: { where: { published: true } },
              likes: true,
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
      }

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
        worldCount: user._count.worlds,
        likeCount: user._count.likes,
      };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(500).optional(),
        avatarUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, string> = {};
      if (input.displayName !== undefined) {
        data.displayName = input.displayName;
      }
      if (input.bio !== undefined) {
        data.bio = input.bio;
      }
      if (input.avatarUrl !== undefined) {
        data.avatarUrl = input.avatarUrl;
      }

      if (Object.keys(data).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No fields to update.',
        });
      }

      const updated = await ctx.db.user.update({
        where: { id: ctx.userId },
        data,
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
        },
      });

      return updated;
    }),

  getCredits: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        credits: true,
        plan: true,
        _count: { select: { worlds: true } },
      },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' });
    }

    const planLimits: Record<string, { credits: number; worlds: number }> = {
      free: { credits: 5, worlds: 3 },
      starter: { credits: 30, worlds: 15 },
      pro: { credits: 100, worlds: 50 },
      enterprise: { credits: 999, worlds: 999 },
    };

    const limits = planLimits[user.plan] ?? planLimits.free;

    return {
      credits: user.credits,
      maxCredits: limits.credits,
      plan: user.plan,
      worldsCreated: user._count.worlds,
      maxWorlds: limits.worlds,
    };
  }),
});
