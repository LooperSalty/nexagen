import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { PrismaClient } from '@nexagen/db';
import type Redis from 'ioredis';
import { prisma } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { verifyClerkToken } from '../middleware/auth.js';

export interface Context {
  readonly db: PrismaClient;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly redis: Redis;
}

export async function createContext(opts: CreateFastifyContextOptions): Promise<Context> {
  const authHeader = opts.req.headers.authorization;
  const { userId, sessionId } = await verifyClerkToken(authHeader);

  return {
    db: prisma,
    userId,
    sessionId,
    redis,
  };
}
