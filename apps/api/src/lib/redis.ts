import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: false,
    enableReadyCheck: true,
  });

  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('connect', () => {
    console.info('[Redis] Connected successfully');
  });

  return client;
}

export const redis = createRedisClient();

export function createRedisConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
