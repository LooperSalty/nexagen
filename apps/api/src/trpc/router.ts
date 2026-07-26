import { t } from './trpc.js';
import { worldRouter } from './routers/world.js';
import { generationRouter } from './routers/generation.js';
import { gameRouter } from './routers/game.js';
import { socialRouter } from './routers/social.js';
import { userRouter } from './routers/user.js';
import { billingRouter } from './routers/billing.js';

export const appRouter = t.router({
  world: worldRouter,
  generation: generationRouter,
  game: gameRouter,
  social: socialRouter,
  user: userRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;

export { t, publicProcedure, protectedProcedure } from './trpc.js';
