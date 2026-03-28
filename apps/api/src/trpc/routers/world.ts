import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { t, publicProcedure, protectedProcedure } from '../router.js';
import { terrainQueue, creatureQueue, narrativeQueue } from '../../lib/queue.js';
import { GenerationStatus } from '@nexagen/shared';

export const worldRouter = t.router({
  create: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(3).max(500),
        seed: z.number().int().optional(),
        size: z.enum(['small', 'medium', 'large']).optional().default('medium'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sizeMap = { small: 64, medium: 128, large: 256 } as const;
      const numericSize = sizeMap[input.size];
      const seed = input.seed ?? Math.floor(Math.random() * 2_147_483_647);

      const world = await ctx.db.world.create({
        data: {
          name: input.prompt.slice(0, 80),
          description: input.prompt,
          seed,
          size: numericSize,
          ownerId: ctx.userId,
          status: GenerationStatus.GENERATING_TERRAIN,
        },
      });

      const jobData = {
        worldId: world.id,
        prompt: input.prompt,
        seed,
        size: numericSize,
        userId: ctx.userId,
      };

      await terrainQueue.add('generate-terrain', jobData, {
        jobId: `terrain-${world.id}`,
      });

      await ctx.redis.set(
        `generation:${world.id}`,
        JSON.stringify({
          status: GenerationStatus.GENERATING_TERRAIN,
          progress: 0,
          message: 'Starting terrain generation...',
        }),
        'EX',
        3600,
      );

      return { worldId: world.id };
    }),

  get: publicProcedure
    .input(z.object({ worldId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const world = await ctx.db.world.findUnique({
        where: { id: input.worldId },
        include: {
          owner: { select: { id: true, username: true, displayName: true } },
          _count: { select: { likes: true, comments: true } },
        },
      });

      if (!world) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'World not found.' });
      }

      return {
        id: world.id,
        name: world.name,
        description: world.description,
        seed: {
          seed: world.seed,
          biomeScale: 1.0,
          heightScale: 1.0,
          seaLevel: 62,
          treeFrequency: 0.05,
        },
        createdAt: world.createdAt.toISOString(),
        updatedAt: world.updatedAt.toISOString(),
        version: world.version,
        chunkCount: world.chunkCount,
        playerCount: world.playerCount,
        theme: world.theme ?? 'default',
        thumbnailUrl: world.thumbnailUrl,
        owner: world.owner,
        likeCount: world._count.likes,
        commentCount: world._count.comments,
        status: world.status,
      };
    }),

  list: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        sort: z.enum(['newest', 'popular', 'trending']).default('newest'),
        biome: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, sort, biome } = input;
      const skip = (page - 1) * limit;

      const orderBy = (() => {
        switch (sort) {
          case 'popular':
            return { playCount: 'desc' as const };
          case 'trending':
            return { likeCount: 'desc' as const };
          case 'newest':
          default:
            return { createdAt: 'desc' as const };
        }
      })();

      const where = {
        published: true,
        status: GenerationStatus.COMPLETE,
        ...(biome ? { tags: { has: biome } } : {}),
      };

      const [worlds, total] = await Promise.all([
        ctx.db.world.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            owner: { select: { id: true, username: true, displayName: true } },
            _count: { select: { likes: true } },
          },
        }),
        ctx.db.world.count({ where }),
      ]);

      return {
        items: worlds.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          thumbnailUrl: w.thumbnailUrl,
          owner: w.owner,
          playCount: w.playCount,
          likeCount: w._count.likes,
          tags: w.tags,
          createdAt: w.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  getMyWorlds: protectedProcedure.query(async ({ ctx }) => {
    const worlds = await ctx.db.world.findMany({
      where: { ownerId: ctx.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { likes: true } },
      },
    });

    return worlds.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      thumbnailUrl: w.thumbnailUrl,
      status: w.status,
      published: w.published,
      playCount: w.playCount,
      likeCount: w._count.likes,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }));
  }),

  delete: protectedProcedure
    .input(z.object({ worldId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.world.findUnique({
        where: { id: input.worldId },
        select: { ownerId: true },
      });

      if (!world) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'World not found.' });
      }

      if (world.ownerId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this world.' });
      }

      await ctx.db.world.delete({ where: { id: input.worldId } });
      await ctx.redis.del(`generation:${input.worldId}`);

      return { success: true };
    }),

  publish: protectedProcedure
    .input(
      z.object({
        worldId: z.string().uuid(),
        title: z.string().min(1).max(100),
        description: z.string().max(2000),
        tags: z.array(z.string().max(30)).max(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.world.findUnique({
        where: { id: input.worldId },
        select: { ownerId: true, status: true },
      });

      if (!world) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'World not found.' });
      }

      if (world.ownerId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this world.' });
      }

      if (world.status !== GenerationStatus.COMPLETE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'World generation must be complete before publishing.',
        });
      }

      const updated = await ctx.db.world.update({
        where: { id: input.worldId },
        data: {
          name: input.title,
          description: input.description,
          tags: input.tags,
          published: true,
          publishedAt: new Date(),
        },
      });

      return { worldId: updated.id, published: true };
    }),
});
