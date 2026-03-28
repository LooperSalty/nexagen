import { Queue } from 'bullmq';
import { createRedisConnection } from './redis.js';

const connection = createRedisConnection();

export const terrainQueue = new Queue('terrain-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const creatureQueue = new Queue('creature-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const narrativeQueue = new Queue('narrative-generation', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const assetQueue = new Queue('asset-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});
