import type { ChunkData, ChunkCoord } from '../types/world';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../types/world';

/**
 * Creates a new empty chunk filled with air (block id 0).
 */
export function createEmptyChunk(cx: number, cz: number): ChunkData {
  return {
    position: { cx, cz },
    blocks: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
    heightmap: new Uint16Array(CHUNK_SIZE * CHUNK_SIZE),
    biomeMap: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
    meshDirty: true,
    lodLevel: 0,
  };
}

/**
 * Computes the flat index into the blocks array for a local coordinate.
 * Layout: x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
 */
export function getBlockIndex(x: number, y: number, z: number): number {
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

/**
 * Returns the block id at the given local coordinates within a chunk.
 * Returns 0 (air) if out of bounds.
 */
export function getBlock(chunk: ChunkData, x: number, y: number, z: number): number {
  if (!isInBounds(x, y, z)) return 0;
  return chunk.blocks[getBlockIndex(x, y, z)];
}

/**
 * Returns a new ChunkData with the block at (x, y, z) set to blockId.
 * Immutable: does not mutate the original chunk.
 */
export function setBlock(
  chunk: ChunkData,
  x: number,
  y: number,
  z: number,
  blockId: number,
): ChunkData {
  if (!isInBounds(x, y, z)) return chunk;

  const newBlocks = new Uint8Array(chunk.blocks);
  newBlocks[getBlockIndex(x, y, z)] = blockId;

  const newHeightmap = new Uint16Array(chunk.heightmap);
  const hmIndex = x + z * CHUNK_SIZE;

  if (blockId !== 0 && y > newHeightmap[hmIndex]) {
    newHeightmap[hmIndex] = y;
  } else if (blockId === 0 && y === newHeightmap[hmIndex]) {
    // Recalculate heightmap for this column
    let highest = 0;
    for (let sy = CHUNK_HEIGHT - 1; sy >= 0; sy--) {
      if (newBlocks[getBlockIndex(x, sy, z)] !== 0) {
        highest = sy;
        break;
      }
    }
    newHeightmap[hmIndex] = highest;
  }

  return {
    position: chunk.position,
    blocks: newBlocks,
    heightmap: newHeightmap,
    biomeMap: chunk.biomeMap,
    meshDirty: true,
    lodLevel: chunk.lodLevel,
  };
}

/**
 * Checks whether the given local coordinates are within chunk bounds.
 */
export function isInBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT && z >= 0 && z < CHUNK_SIZE;
}

/**
 * Returns the 4 cardinal neighbor chunk coordinates.
 */
export function getNeighborChunkCoords(cx: number, cz: number): ChunkCoord[] {
  return [
    { cx: cx + 1, cz },
    { cx: cx - 1, cz },
    { cx, cz: cz + 1 },
    { cx, cz: cz - 1 },
  ];
}

/**
 * Returns chunk coordinates in a spiral order from the center (0,0),
 * covering all chunks within the given radius.
 */
export function getSpiralOrder(radius: number): ChunkCoord[] {
  const result: ChunkCoord[] = [];

  if (radius <= 0) {
    result.push({ cx: 0, cz: 0 });
    return result;
  }

  result.push({ cx: 0, cz: 0 });

  for (let ring = 1; ring <= radius; ring++) {
    // Start at top-left of ring
    let cx = -ring;
    let cz = -ring;

    // Move right along top edge
    for (let i = 0; i < ring * 2; i++) {
      result.push({ cx, cz });
      cx++;
    }
    // Move down along right edge
    for (let i = 0; i < ring * 2; i++) {
      result.push({ cx, cz });
      cz++;
    }
    // Move left along bottom edge
    for (let i = 0; i < ring * 2; i++) {
      result.push({ cx, cz });
      cx--;
    }
    // Move up along left edge
    for (let i = 0; i < ring * 2; i++) {
      result.push({ cx, cz });
      cz--;
    }
  }

  return result;
}
