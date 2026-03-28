import type { ChunkData, Vector3Like, ChunkCoord } from '@nexagen/shared';
import {
  CHUNK_SIZE,
  RENDER_DISTANCE,
  getChunkKey,
  worldToChunk,
  blockToLocal,
  getSpiralOrder,
  getBlock as getBlockFromChunk,
  setBlock as setBlockInChunk,
} from '@nexagen/shared';
import { TerrainGenerator } from './TerrainGenerator';

const MAX_LOADS_PER_FRAME = 2;

export class ChunkManager {
  private readonly _chunks: Map<string, ChunkData> = new Map();
  private readonly _loadQueue: ChunkCoord[] = [];
  private readonly _terrainGenerator: TerrainGenerator;
  private readonly _spiralOrder: readonly ChunkCoord[];

  constructor(terrainGenerator: TerrainGenerator) {
    this._terrainGenerator = terrainGenerator;
    this._spiralOrder = getSpiralOrder(RENDER_DISTANCE);
  }

  get chunkCount(): number {
    return this._chunks.size;
  }

  update(playerPosition: Vector3Like): void {
    const playerChunk = worldToChunk(playerPosition.x, playerPosition.z);

    this._updateLoadQueue(playerChunk);
    this._processLoadQueue(MAX_LOADS_PER_FRAME);
    this._unloadDistantChunks(playerPosition, (RENDER_DISTANCE + 2) * CHUNK_SIZE);
  }

  getChunk(cx: number, cz: number): ChunkData | undefined {
    return this._chunks.get(getChunkKey(cx, cz));
  }

  getBlock(worldX: number, worldY: number, worldZ: number): number {
    const floorX = Math.floor(worldX);
    const floorY = Math.floor(worldY);
    const floorZ = Math.floor(worldZ);

    const { cx, cz } = worldToChunk(floorX, floorZ);
    const chunk = this._chunks.get(getChunkKey(cx, cz));

    if (!chunk) {
      return 0;
    }

    const { lx, ly, lz } = blockToLocal(floorX, floorY, floorZ);
    return getBlockFromChunk(chunk, lx, ly, lz);
  }

  setBlock(worldX: number, worldY: number, worldZ: number, blockId: number): void {
    const floorX = Math.floor(worldX);
    const floorY = Math.floor(worldY);
    const floorZ = Math.floor(worldZ);

    const { cx, cz } = worldToChunk(floorX, floorZ);
    const key = getChunkKey(cx, cz);
    const chunk = this._chunks.get(key);

    if (!chunk) {
      return;
    }

    const { lx, ly, lz } = blockToLocal(floorX, floorY, floorZ);
    const updatedChunk = setBlockInChunk(chunk, lx, ly, lz, blockId);
    this._chunks.set(key, updatedChunk);

    // Mark neighbor chunks as dirty if block is on a chunk boundary
    if (lx === 0) {
      this._markDirty(cx - 1, cz);
    }
    if (lx === CHUNK_SIZE - 1) {
      this._markDirty(cx + 1, cz);
    }
    if (lz === 0) {
      this._markDirty(cx, cz - 1);
    }
    if (lz === CHUNK_SIZE - 1) {
      this._markDirty(cx, cz + 1);
    }
  }

  hasChunk(cx: number, cz: number): boolean {
    return this._chunks.has(getChunkKey(cx, cz));
  }

  getLoadedChunks(): ReadonlyMap<string, ChunkData> {
    return this._chunks;
  }

  private _markDirty(cx: number, cz: number): void {
    const key = getChunkKey(cx, cz);
    const chunk = this._chunks.get(key);
    if (chunk && !chunk.meshDirty) {
      const dirtyChunk: ChunkData = {
        position: chunk.position,
        blocks: chunk.blocks,
        heightmap: chunk.heightmap,
        biomeMap: chunk.biomeMap,
        meshDirty: true,
        lodLevel: chunk.lodLevel,
      };
      this._chunks.set(key, dirtyChunk);
    }
  }

  private _updateLoadQueue(playerChunk: ChunkCoord): void {
    this._loadQueue.length = 0;

    for (const offset of this._spiralOrder) {
      const cx = playerChunk.cx + offset.cx;
      const cz = playerChunk.cz + offset.cz;

      if (!this._chunks.has(getChunkKey(cx, cz))) {
        this._loadQueue.push({ cx, cz });
      }
    }

    // Sort by distance to player chunk (spiral order already roughly sorted,
    // but re-sort to ensure priority after player movement)
    this._loadQueue.sort((a, b) => {
      const distA =
        (a.cx - playerChunk.cx) * (a.cx - playerChunk.cx) +
        (a.cz - playerChunk.cz) * (a.cz - playerChunk.cz);
      const distB =
        (b.cx - playerChunk.cx) * (b.cx - playerChunk.cx) +
        (b.cz - playerChunk.cz) * (b.cz - playerChunk.cz);
      return distA - distB;
    });
  }

  private _processLoadQueue(maxLoads: number): void {
    const count = Math.min(maxLoads, this._loadQueue.length);

    for (let i = 0; i < count; i++) {
      const coord = this._loadQueue[i];
      this._loadChunk(coord.cx, coord.cz);
    }
  }

  private _loadChunk(cx: number, cz: number): void {
    const key = getChunkKey(cx, cz);
    if (this._chunks.has(key)) {
      return;
    }

    const chunk = this._terrainGenerator.generateChunk(cx, cz);
    this._chunks.set(key, chunk);
  }

  private _unloadDistantChunks(playerPos: Vector3Like, maxDistance: number): void {
    const maxDistSq = maxDistance * maxDistance;
    const keysToRemove: string[] = [];

    for (const [key, chunk] of this._chunks) {
      const chunkCenterX = chunk.position.cx * CHUNK_SIZE + CHUNK_SIZE / 2;
      const chunkCenterZ = chunk.position.cz * CHUNK_SIZE + CHUNK_SIZE / 2;

      const dx = chunkCenterX - playerPos.x;
      const dz = chunkCenterZ - playerPos.z;
      const distSq = dx * dx + dz * dz;

      if (distSq > maxDistSq) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this._chunks.delete(key);
    }
  }
}
