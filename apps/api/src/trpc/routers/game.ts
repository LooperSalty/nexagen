import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { t, protectedProcedure } from '../router.js';
import { checkRateLimit, rateLimitKey } from '../../middleware/rateLimit.js';
import { npcDialogue } from '../../lib/ai-client.js';

export const gameRouter = t.router({
  saveState: protectedProcedure
    .input(
      z.object({
        worldId: z.string().uuid(),
        state: z.object({
          position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
          rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }),
          hp: z.number().min(0),
          maxHp: z.number().min(1),
          inventory: z.array(
            z
              .object({
                item: z.object({
                  id: z.string(),
                  name: z.string(),
                  type: z.string(),
                  stackable: z.boolean(),
                  maxStack: z.number(),
                  rarity: z.string(),
                  icon: z.string(),
                  description: z.string(),
                }),
                quantity: z.number().min(1),
              })
              .nullable(),
          ),
          hotbarSlot: z.number().int().min(0).max(8),
          questProgress: z.array(z.string()),
          playTime: z.number().min(0),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const save = await ctx.db.gameSave.upsert({
        where: {
          userId_worldId: {
            userId: ctx.userId,
            worldId: input.worldId,
          },
        },
        create: {
          userId: ctx.userId,
          worldId: input.worldId,
          state: JSON.parse(JSON.stringify(input.state)),
        },
        update: {
          state: JSON.parse(JSON.stringify(input.state)),
          updatedAt: new Date(),
        },
      });

      return { savedAt: save.updatedAt.toISOString() };
    }),

  loadState: protectedProcedure
    .input(z.object({ worldId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const save = await ctx.db.gameSave.findUnique({
        where: {
          userId_worldId: {
            userId: ctx.userId,
            worldId: input.worldId,
          },
        },
      });

      if (!save) {
        return null;
      }

      return {
        state: save.state as Record<string, unknown>,
        savedAt: save.updatedAt.toISOString(),
      };
    }),

  dialogue: protectedProcedure
    .input(
      z.object({
        worldId: z.string().uuid(),
        npcId: z.string(),
        message: z.string().min(1).max(500).trim(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rlKey = rateLimitKey(ctx.userId, 'npc-dialogue');
      const rlResult = await checkRateLimit(rlKey, {
        windowMs: 2000,
        maxRequests: 1,
      });

      if (!rlResult.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Please wait before sending another message.',
        });
      }

      const npcDataRaw = await ctx.redis.get(`npc:${input.worldId}:${input.npcId}`);

      if (!npcDataRaw) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'NPC not found in this world.',
        });
      }

      const npcData = JSON.parse(npcDataRaw) as {
        name: string;
        role: string;
        personality: string;
        backstory: string;
        mood: number;
        relationship: number;
      };

      const historyKey = `dialogue:${ctx.userId}:${input.npcId}`;
      const rawHistory = await ctx.redis.lrange(historyKey, -10, -1);
      const recentMessages = rawHistory.map((raw) => {
        const parsed = JSON.parse(raw) as { role: string; content: string };
        return parsed;
      });

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { username: true },
      });

      const result = await npcDialogue(input.npcId, input.message, {
        worldId: input.worldId,
        playerName: user?.username ?? 'Adventurer',
        npcData,
        recentMessages,
      });

      const pipeline = ctx.redis.pipeline();
      pipeline.rpush(
        historyKey,
        JSON.stringify({ role: 'user', content: input.message }),
      );
      pipeline.rpush(
        historyKey,
        JSON.stringify({ role: 'assistant', content: result.response }),
      );
      pipeline.ltrim(historyKey, -20, -1);
      pipeline.expire(historyKey, 7200);
      await pipeline.exec();

      const updatedNpc = {
        ...npcData,
        mood: result.mood,
        relationship: result.relationship,
      };
      await ctx.redis.set(
        `npc:${input.worldId}:${input.npcId}`,
        JSON.stringify(updatedNpc),
        'EX',
        7200,
      );

      return {
        response: result.response,
        mood: result.mood,
        relationship: result.relationship,
        actions: result.actions,
      };
    }),
});
