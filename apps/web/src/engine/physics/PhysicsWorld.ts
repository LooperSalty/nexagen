import type { Vector3Like } from '@nexagen/shared';
import { BLOCK_DEFINITIONS, BlockId, clamp } from '@nexagen/shared';

export interface AABB {
  readonly min: Vector3Like;
  readonly max: Vector3Like;
}

export interface SweepResult {
  readonly position: Vector3Like;
  readonly velocity: Vector3Like;
  readonly grounded: boolean;
}

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const EPSILON = 0.001;

export function getPlayerAABB(position: Vector3Like): AABB {
  const halfWidth = PLAYER_WIDTH / 2;
  return {
    min: {
      x: position.x - halfWidth,
      y: position.y,
      z: position.z - halfWidth,
    },
    max: {
      x: position.x + halfWidth,
      y: position.y + PLAYER_HEIGHT,
      z: position.z + halfWidth,
    },
  };
}

export function getBlockAABB(x: number, y: number, z: number): AABB {
  return {
    min: { x, y, z },
    max: { x: x + 1, y: y + 1, z: z + 1 },
  };
}

export function testAABBOverlap(a: AABB, b: AABB): boolean {
  return (
    a.min.x < b.max.x &&
    a.max.x > b.min.x &&
    a.min.y < b.max.y &&
    a.max.y > b.min.y &&
    a.min.z < b.max.z &&
    a.max.z > b.min.z
  );
}

function isSolidBlock(blockId: number): boolean {
  if (blockId === BlockId.AIR) return false;
  const def = BLOCK_DEFINITIONS[blockId];
  return def ? def.solid : false;
}

function getOverlappingBlocks(
  aabb: AABB,
  getBlock: (x: number, y: number, z: number) => number,
): Array<{ x: number; y: number; z: number }> {
  const blocks: Array<{ x: number; y: number; z: number }> = [];

  const minBX = Math.floor(aabb.min.x);
  const minBY = Math.floor(aabb.min.y);
  const minBZ = Math.floor(aabb.min.z);
  const maxBX = Math.floor(aabb.max.x);
  const maxBY = Math.floor(aabb.max.y);
  const maxBZ = Math.floor(aabb.max.z);

  for (let bx = minBX; bx <= maxBX; bx++) {
    for (let by = minBY; by <= maxBY; by++) {
      for (let bz = minBZ; bz <= maxBZ; bz++) {
        const blockId = getBlock(bx, by, bz);
        if (isSolidBlock(blockId)) {
          blocks.push({ x: bx, y: by, z: bz });
        }
      }
    }
  }

  return blocks;
}

export function sweepAABB(
  aabb: AABB,
  velocity: Vector3Like,
  getBlock: (x: number, y: number, z: number) => number,
  deltaTime: number,
): SweepResult {
  const halfWidth = (aabb.max.x - aabb.min.x) / 2;
  const height = aabb.max.y - aabb.min.y;

  // Current center-bottom position
  let posX = aabb.min.x + halfWidth;
  let posY = aabb.min.y;
  let posZ = aabb.min.z + halfWidth;

  let vx = velocity.x * deltaTime;
  let vy = velocity.y * deltaTime;
  let vz = velocity.z * deltaTime;

  let grounded = false;

  // Resolve Y axis first (gravity/jump)
  {
    const testAABB: AABB = {
      min: { x: posX - halfWidth, y: posY + vy, z: posZ - halfWidth },
      max: { x: posX + halfWidth, y: posY + vy + height, z: posZ + halfWidth },
    };

    const blocks = getOverlappingBlocks(testAABB, getBlock);
    let resolved = false;

    for (const block of blocks) {
      const blockBox = getBlockAABB(block.x, block.y, block.z);

      if (testAABBOverlap(testAABB, blockBox)) {
        if (vy < 0) {
          // Falling: snap to top of block
          posY = blockBox.max.y + EPSILON;
          vy = 0;
          grounded = true;
          resolved = true;
        } else if (vy > 0) {
          // Jumping: snap to bottom of block
          posY = blockBox.min.y - height - EPSILON;
          vy = 0;
          resolved = true;
        }
        break;
      }
    }

    if (!resolved) {
      posY += vy;
    }
  }

  // Resolve X axis
  {
    const testAABB: AABB = {
      min: { x: posX - halfWidth + vx, y: posY, z: posZ - halfWidth },
      max: { x: posX + halfWidth + vx, y: posY + height, z: posZ + halfWidth },
    };

    const blocks = getOverlappingBlocks(testAABB, getBlock);
    let blocked = false;

    for (const block of blocks) {
      const blockBox = getBlockAABB(block.x, block.y, block.z);

      if (testAABBOverlap(testAABB, blockBox)) {
        if (vx > 0) {
          posX = blockBox.min.x - halfWidth - EPSILON;
        } else if (vx < 0) {
          posX = blockBox.max.x + halfWidth + EPSILON;
        }
        vx = 0;
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      posX += vx;
    }
  }

  // Resolve Z axis
  {
    const testAABB: AABB = {
      min: { x: posX - halfWidth, y: posY, z: posZ - halfWidth + vz },
      max: { x: posX + halfWidth, y: posY + height, z: posZ + halfWidth + vz },
    };

    const blocks = getOverlappingBlocks(testAABB, getBlock);
    let blocked = false;

    for (const block of blocks) {
      const blockBox = getBlockAABB(block.x, block.y, block.z);

      if (testAABBOverlap(testAABB, blockBox)) {
        if (vz > 0) {
          posZ = blockBox.min.z - halfWidth - EPSILON;
        } else if (vz < 0) {
          posZ = blockBox.max.z + halfWidth + EPSILON;
        }
        vz = 0;
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      posZ += vz;
    }
  }

  return {
    position: { x: posX, y: posY, z: posZ },
    velocity: {
      x: vx === 0 ? 0 : velocity.x,
      y: vy === 0 ? 0 : velocity.y,
      z: vz === 0 ? 0 : velocity.z,
    },
    grounded,
  };
}

export class PhysicsWorld {
  testOverlap(a: AABB, b: AABB): boolean {
    return testAABBOverlap(a, b);
  }

  getPlayerBounds(position: Vector3Like): AABB {
    return getPlayerAABB(position);
  }

  getBlockBounds(x: number, y: number, z: number): AABB {
    return getBlockAABB(x, y, z);
  }

  sweep(
    aabb: AABB,
    velocity: Vector3Like,
    getBlock: (x: number, y: number, z: number) => number,
    deltaTime: number,
  ): SweepResult {
    return sweepAABB(aabb, velocity, getBlock, deltaTime);
  }
}
