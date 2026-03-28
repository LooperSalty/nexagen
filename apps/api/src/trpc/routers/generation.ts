import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { t, protectedProcedure } from '../router.js';
import { GenerationStatus } from '@nexagen/shared';

interface StoredProgress {
  readonly status: GenerationStatus;
  readonly progress: number;
  readonly message: string;
}

export const generationRouter = t.router({
  getStatus: protectedProcedure
    .input(z.object({ worldId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cached = await ctx.redis.get(`generation:${input.worldId}`);

      if (cached) {
        const parsed = JSON.parse(cached) as StoredProgress;
        const eta = estimateEta(parsed.status, parsed.progress);
        return { ...parsed, eta };
      }

      const world = await ctx.db.world.findUnique({
        where: { id: input.worldId },
        select: { status: true, ownerId: true },
      });

      if (!world) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'World not found.' });
      }

      if (world.ownerId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this world.' });
      }

      return {
        status: world.status as GenerationStatus,
        progress: world.status === GenerationStatus.COMPLETE ? 100 : 0,
        message: getStatusMessage(world.status as GenerationStatus),
        eta: null,
      };
    }),
});

function estimateEta(status: GenerationStatus, progress: number): number | null {
  if (status === GenerationStatus.COMPLETE || status === GenerationStatus.ERROR) {
    return null;
  }

  const stageWeights: Record<string, { base: number; weight: number }> = {
    [GenerationStatus.GENERATING_TERRAIN]: { base: 30, weight: 0.4 },
    [GenerationStatus.GENERATING_ENTITIES]: { base: 20, weight: 0.25 },
    [GenerationStatus.GENERATING_QUESTS]: { base: 15, weight: 0.15 },
    [GenerationStatus.GENERATING_NPCS]: { base: 15, weight: 0.2 },
  };

  const stage = stageWeights[status];
  if (!stage) {
    return null;
  }

  const stageProgress = progress / 100;
  const remainingInStage = stage.base * (1 - stageProgress);

  return Math.ceil(remainingInStage);
}

function getStatusMessage(status: GenerationStatus): string {
  switch (status) {
    case GenerationStatus.IDLE:
      return 'Waiting to start...';
    case GenerationStatus.GENERATING_TERRAIN:
      return 'Generating terrain and biomes...';
    case GenerationStatus.GENERATING_ENTITIES:
      return 'Spawning creatures and entities...';
    case GenerationStatus.GENERATING_QUESTS:
      return 'Crafting quests and storylines...';
    case GenerationStatus.GENERATING_NPCS:
      return 'Creating NPCs and dialogue...';
    case GenerationStatus.COMPLETE:
      return 'World generation complete!';
    case GenerationStatus.ERROR:
      return 'An error occurred during generation.';
    default:
      return 'Processing...';
  }
}
