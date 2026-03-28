import { redis } from '../lib/redis.js';

export interface RateLimitConfig {
  readonly windowMs: number;
  readonly maxRequests: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 60,
};

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const key = `ratelimit:${identifier}`;

  const pipeline = redis.pipeline();

  // Remove expired entries
  pipeline.zremrangebyscore(key, 0, windowStart);
  // Add current request
  pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);
  // Count requests in window
  pipeline.zcard(key);
  // Set expiry on the key
  pipeline.pexpire(key, config.windowMs);

  const results = await pipeline.exec();

  if (!results) {
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  const count = (results[2]?.[1] as number) ?? 0;
  const allowed = count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count);

  return {
    allowed,
    remaining,
    resetAt: now + config.windowMs,
  };
}

export function rateLimitKey(userId: string | null, action: string): string {
  const id = userId ?? 'anonymous';
  return `${action}:${id}`;
}
