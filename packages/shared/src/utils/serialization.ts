import type { ChunkData } from '../types/world';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../types/world';
import { createEmptyChunk } from './chunk-utils';

/**
 * Compresses chunk block data using Run-Length Encoding (RLE).
 *
 * Format: [blockId (1 byte), runLength (2 bytes big-endian)] repeating.
 * Each run encodes up to 65535 consecutive identical blocks.
 */
export function compressChunk(chunk: ChunkData): Uint8Array {
  const blocks = chunk.blocks;
  const runs: Array<{ blockId: number; count: number }> = [];

  let currentId = blocks[0];
  let count = 1;

  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i] === currentId && count < 65535) {
      count++;
    } else {
      runs.push({ blockId: currentId, count });
      currentId = blocks[i];
      count = 1;
    }
  }
  runs.push({ blockId: currentId, count });

  // Each run = 3 bytes (1 for blockId + 2 for count)
  const buffer = new Uint8Array(runs.length * 3);
  let offset = 0;

  for (const run of runs) {
    buffer[offset] = run.blockId;
    buffer[offset + 1] = (run.count >> 8) & 0xff;
    buffer[offset + 2] = run.count & 0xff;
    offset += 3;
  }

  return buffer;
}

/**
 * Decompresses RLE-encoded block data back into a ChunkData object.
 */
export function decompressChunk(data: Uint8Array, cx: number, cz: number): ChunkData {
  const totalBlocks = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE;
  const blocks = new Uint8Array(totalBlocks);
  const heightmap = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE);

  let blockIndex = 0;
  let offset = 0;

  while (offset < data.length && blockIndex < totalBlocks) {
    const blockId = data[offset];
    const count = (data[offset + 1] << 8) | data[offset + 2];
    offset += 3;

    const end = Math.min(blockIndex + count, totalBlocks);
    for (let i = blockIndex; i < end; i++) {
      blocks[i] = blockId;
    }
    blockIndex = end;
  }

  // Rebuild heightmap
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      let highest = 0;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const idx = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
        if (blocks[idx] !== 0) {
          highest = y;
          break;
        }
      }
      heightmap[x + z * CHUNK_SIZE] = highest;
    }
  }

  return {
    position: { cx, cz },
    blocks,
    heightmap,
    biomeMap: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE),
    meshDirty: true,
    lodLevel: 0,
  };
}

/**
 * Packs three coordinates into a single 64-bit-safe number.
 *
 * Layout (within 52-bit safe integer range):
 *   x: bits 0-16  (signed, range -32768..32767)
 *   y: bits 17-25 (unsigned, range 0..511, covers CHUNK_HEIGHT=256)
 *   z: bits 26-42 (signed, range -32768..32767)
 *
 * The sign is handled by adding an offset of 32768 to x and z.
 */
export function encodePosition(x: number, y: number, z: number): number {
  const ux = (x + 32768) & 0xffff;
  const uy = y & 0x1ff;
  const uz = (z + 32768) & 0xffff;
  return ux | (uy << 17) | (uz << 26);
}

/**
 * Unpacks a number produced by encodePosition back into coordinates.
 */
export function decodePosition(packed: number): { x: number; y: number; z: number } {
  const ux = packed & 0xffff;
  const uy = (packed >> 17) & 0x1ff;
  const uz = (packed >> 26) & 0xffff;
  return {
    x: ux - 32768,
    y: uy,
    z: uz - 32768,
  };
}
