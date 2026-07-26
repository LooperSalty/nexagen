import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';

/**
 * tRPC initialization lives in its own module so that the feature routers and
 * the composed app router can both import the shared builders without creating
 * a circular dependency (routers/* -> router.ts -> routers/*).
 */
const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export { t };
