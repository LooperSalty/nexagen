import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { t, publicProcedure, protectedProcedure } from '../router.js';

export const socialRouter = t.router({
  like: protectedProcedure
    .input(z.object({ worldId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.world.findUnique({
        where: { id: input.worldId },
        select: { id: true },
      });

      if (!world) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'World not found.' });
      }

      const existingLike = await ctx.db.like.findUnique({
        where: {
          userId_worldId: {
            userId: ctx.userId,
            worldId: input.worldId,
          },
        },
      });

      if (existingLike) {
        await ctx.db.like.delete({
          where: {
            userId_worldId: {
              userId: ctx.userId,
              worldId: input.worldId,
            },
          },
        });

        await ctx.db.world.update({
          where: { id: input.worldId },
          data: { likeCount: { decrement: 1 } },
        });

        return { liked: false };
      }

      await ctx.db.like.create({
        data: {
          userId: ctx.userId,
          worldId: input.worldId,
        },
      });

      await ctx.db.world.update({
        where: { id: input.worldId },
        data: { likeCount: { increment: 1 } },
      });

      return { liked: true };
    }),

  comment: protectedProcedure
    .input(
      z.object({
        worldId: z.string().uuid(),
        content: z.string().min(1).max(1000).trim(),
        parentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const world = await ctx.db.world.findUnique({
        where: { id: input.worldId },
        select: { id: true },
      });

      if (!world) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'World not found.' });
      }

      if (input.parentId) {
        const parent = await ctx.db.comment.findUnique({
          where: { id: input.parentId },
          select: { id: true, worldId: true },
        });

        if (!parent || parent.worldId !== input.worldId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid parent comment.' });
        }
      }

      const comment = await ctx.db.comment.create({
        data: {
          content: input.content,
          userId: ctx.userId,
          worldId: input.worldId,
          parentId: input.parentId ?? null,
        },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      return {
        id: comment.id,
        content: comment.content,
        user: comment.user,
        createdAt: comment.createdAt.toISOString(),
        parentId: comment.parentId,
      };
    }),

  getComments: publicProcedure
    .input(
      z.object({
        worldId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { worldId, page, limit } = input;
      const skip = (page - 1) * limit;

      const [comments, total] = await Promise.all([
        ctx.db.comment.findMany({
          where: { worldId, parentId: null },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              take: 3,
              include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              },
            },
            _count: { select: { replies: true } },
          },
        }),
        ctx.db.comment.count({ where: { worldId, parentId: null } }),
      ]);

      return {
        items: comments.map((c) => ({
          id: c.id,
          content: c.content,
          user: c.user,
          createdAt: c.createdAt.toISOString(),
          replies: c.replies.map((r) => ({
            id: r.id,
            content: r.content,
            user: r.user,
            createdAt: r.createdAt.toISOString(),
          })),
          replyCount: c._count.replies,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),
});
