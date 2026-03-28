import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';
import { worldRouter } from './routers/world.js';
import { generationRouter } from './routers/generation.js';
import { gameRouter } from './routers/game.js';
import { socialRouter } from './routers/social.js';
import { userRouter } from './routers/user.js';
import { billingRouter } from './routers/billing.js';

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

export const appRouter = t.router({
  world: worldRouter,
  generation: generationRouter,
  game: gameRouter,
  social: socialRouter,
  user: userRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;

export { t };
