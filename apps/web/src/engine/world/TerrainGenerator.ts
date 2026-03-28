import type { ChunkData, WorldSeed } from '@nexagen/shared';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  BiomeType,
  BlockId,
  BIOME_CONFIG,
  SimplexNoise,
  createEmptyChunk,
  getBlockIndex,
  clamp,
  smoothstep,
} from '@nexagen/shared';

export class TerrainGenerator {
  private readonly _seed: WorldSeed;
  private readonly _continentNoise: SimplexNoise;
  private readonly _heightNoise: SimplexNoise;
  private readonly _detailNoise: SimplexNoise;
  private readonly _caveNoise: SimplexNoise;
  private readonly _temperatureNoise: SimplexNoise;
  private readonly _humidityNoise: SimplexNoise;
  private readonly _treeNoise: SimplexNoise;
  private readonly _decorNoise: SimplexNoise;

  constructor(seed: WorldSeed) {
    this._seed = seed;
    this._continentNoise = new SimplexNoise(seed.seed);
    this._heightNoise = new SimplexNoise(seed.seed + 1);
    this._detailNoise = new SimplexNoise(seed.seed + 2);
    this._caveNoise = new SimplexNoise(seed.seed + 3);
    this._temperatureNoise = new SimplexNoise(seed.seed + 4);
    this._humidityNoise = new SimplexNoise(seed.seed + 5);
    this._treeNoise = new SimplexNoise(seed.seed + 6);
    this._decorNoise = new SimplexNoise(seed.seed + 7);
  }

  generateChunk(cx: number, cz: number): ChunkData {
    const chunk = createEmptyChunk(cx, cz);
    const blocks = new Uint8Array(chunk.blocks);
    const heightmap = new Uint16Array(chunk.heightmap);
    const biomeMap = new Uint8Array(chunk.biomeMap);

    const worldOffsetX = cx * CHUNK_SIZE;
    const worldOffsetZ = cz * CHUNK_SIZE;
    const seaLevel = this._seed.seaLevel;

    // Phase 1: compute height and biome per column, fill terrain
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = worldOffsetX + lx;
        const wz = worldOffsetZ + lz;

        const biome = this._getBiome(wx, wz);
        const biomeConfig = BIOME_CONFIG[biome];
        const columnIndex = lx + lz * CHUNK_SIZE;
        biomeMap[columnIndex] = biome;

        const height = this._getHeight(wx, wz, biomeConfig.minHeight, biomeConfig.maxHeight);
        const clampedHeight = clamp(Math.floor(height), 1, CHUNK_HEIGHT - 1);
        heightmap[columnIndex] = clampedHeight;

        // Fill column
        for (let y = 0; y <= clampedHeight; y++) {
          const idx = getBlockIndex(lx, y, lz);

          if (y === 0) {
            blocks[idx] = BlockId.STONE;
          } else if (y === clampedHeight) {
            blocks[idx] = biomeConfig.surfaceBlock;
          } else if (y >= clampedHeight - 3) {
            blocks[idx] = biomeConfig.subsurfaceBlock;
          } else {
            blocks[idx] = biomeConfig.fillBlock;
          }
        }

        // Fill water up to sea level
        for (let y = clampedHeight + 1; y <= seaLevel; y++) {
          const idx = getBlockIndex(lx, y, lz);
          if (blocks[idx] === BlockId.AIR) {
            blocks[idx] = BlockId.WATER;
          }
        }

        // Update heightmap if water extends above surface
        if (seaLevel > clampedHeight) {
          heightmap[columnIndex] = seaLevel;
        }
      }
    }

    // Phase 2: cave carving with 3D noise
    this._carveCaves(blocks, worldOffsetX, worldOffsetZ, seaLevel);

    // Phase 3: ore generation
    this._generateOres(blocks, worldOffsetX, worldOffsetZ);

    // Phase 4: decoration (trees, foliage)
    const decoratedBlocks = this._decorateChunk(
      blocks,
      heightmap,
      biomeMap,
      worldOffsetX,
      worldOffsetZ,
      seaLevel,
    );

    return {
      position: { cx, cz },
      blocks: decoratedBlocks,
      heightmap,
      biomeMap,
      meshDirty: true,
      lodLevel: 0,
    };
  }

  private _getBiome(wx: number, wz: number): BiomeType {
    const scale = this._seed.biomeScale;
    const temperature = (this._temperatureNoise.fbm2D(wx / (scale * 2), wz / (scale * 2), 4) + 1) / 2;
    const humidity = (this._humidityNoise.fbm2D(wx / (scale * 1.5), wz / (scale * 1.5), 4) + 1) / 2;

    // Also check continent noise for ocean detection
    const continentValue = this._continentNoise.fbm2D(wx / (scale * 4), wz / (scale * 4), 3);

    if (continentValue < -0.3) {
      return BiomeType.OCEAN;
    }

    if (continentValue < -0.15) {
      return BiomeType.BEACH;
    }

    // Temperature + humidity biome lookup
    let bestBiome = BiomeType.PLAINS;
    let bestScore = -Infinity;

    const candidates: BiomeType[] = [
      BiomeType.PLAINS,
      BiomeType.FOREST,
      BiomeType.DESERT,
      BiomeType.MOUNTAINS,
      BiomeType.SNOW,
      BiomeType.SWAMP,
      BiomeType.JUNGLE,
      BiomeType.SAVANNA,
    ];

    for (const biomeType of candidates) {
      const config = BIOME_CONFIG[biomeType];
      const [tMin, tMax] = config.temperatureRange;
      const [hMin, hMax] = config.humidityRange;

      // Score: how close are we to the center of this biome's range?
      const tCenter = (tMin + tMax) / 2;
      const hCenter = (hMin + hMax) / 2;
      const tRange = (tMax - tMin) / 2;
      const hRange = (hMax - hMin) / 2;

      const tDist = Math.abs(temperature - tCenter) / Math.max(tRange, 0.01);
      const hDist = Math.abs(humidity - hCenter) / Math.max(hRange, 0.01);

      if (tDist <= 1.2 && hDist <= 1.2) {
        const score = 2 - tDist - hDist;
        if (score > bestScore) {
          bestScore = score;
          bestBiome = biomeType;
        }
      }
    }

    return bestBiome;
  }

  private _getHeight(
    wx: number,
    wz: number,
    minHeight: number,
    maxHeight: number,
  ): number {
    const scale = this._seed.heightScale;

    // Continent shape: low frequency
    const continent = this._continentNoise.fbm2D(
      wx / (scale * 4),
      wz / (scale * 4),
      3,
      2.0,
      0.5,
    );

    // Height variation: mid frequency
    const heightVar = this._heightNoise.fbm2D(
      wx / scale,
      wz / scale,
      4,
      2.0,
      0.5,
    );

    // Detail: high frequency
    const detail = this._detailNoise.fbm2D(
      wx / (scale * 0.25),
      wz / (scale * 0.25),
      2,
      2.0,
      0.4,
    );

    // Combine: continent determines base, heightVar adds range, detail adds texture
    const combined = continent * 0.5 + heightVar * 0.35 + detail * 0.15;
    const normalized = (combined + 1) / 2; // Map -1..1 to 0..1

    return minHeight + normalized * (maxHeight - minHeight);
  }

  private _carveCaves(
    blocks: Uint8Array,
    worldOffsetX: number,
    worldOffsetZ: number,
    seaLevel: number,
  ): void {
    const caveThreshold = 0.55;
    const caveScale = 0.05;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = worldOffsetX + lx;
        const wz = worldOffsetZ + lz;

        // Only carve below surface, above bedrock
        for (let y = 2; y < seaLevel - 5; y++) {
          const idx = getBlockIndex(lx, y, lz);
          if (blocks[idx] === BlockId.AIR || blocks[idx] === BlockId.WATER) {
            continue;
          }

          const density = this._caveNoise.noise3D(
            wx * caveScale,
            y * caveScale * 1.5,
            wz * caveScale,
          );

          // Secondary noise for cave variation
          const density2 = this._caveNoise.noise3D(
            wx * caveScale * 2 + 100,
            y * caveScale * 2 + 100,
            wz * caveScale * 2 + 100,
          );

          if (Math.abs(density) + Math.abs(density2) * 0.5 > caveThreshold) {
            blocks[idx] = BlockId.AIR;
          }
        }
      }
    }
  }

  private _generateOres(
    blocks: Uint8Array,
    worldOffsetX: number,
    worldOffsetZ: number,
  ): void {
    const oreConfigs = [
      { blockId: BlockId.COAL_ORE, minY: 5, maxY: 80, scale: 0.12, threshold: 0.7 },
      { blockId: BlockId.IRON_ORE, minY: 5, maxY: 64, scale: 0.11, threshold: 0.75 },
      { blockId: BlockId.GOLD_ORE, minY: 5, maxY: 32, scale: 0.1, threshold: 0.82 },
      { blockId: BlockId.DIAMOND_ORE, minY: 2, maxY: 16, scale: 0.09, threshold: 0.88 },
    ];

    for (const ore of oreConfigs) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = worldOffsetX + lx;
          const wz = worldOffsetZ + lz;

          for (let y = ore.minY; y <= ore.maxY; y++) {
            const idx = getBlockIndex(lx, y, lz);
            if (blocks[idx] !== BlockId.STONE) {
              continue;
            }

            const val = this._caveNoise.noise3D(
              wx * ore.scale + ore.blockId * 100,
              y * ore.scale,
              wz * ore.scale + ore.blockId * 100,
            );

            if (val > ore.threshold) {
              blocks[idx] = ore.blockId;
            }
          }
        }
      }
    }
  }

  private _decorateChunk(
    blocks: Uint8Array,
    heightmap: Uint16Array,
    biomeMap: Uint8Array,
    worldOffsetX: number,
    worldOffsetZ: number,
    seaLevel: number,
  ): Uint8Array {
    // Copy blocks so we don't mutate during iteration
    const decorated = new Uint8Array(blocks);

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = worldOffsetX + lx;
        const wz = worldOffsetZ + lz;
        const columnIndex = lx + lz * CHUNK_SIZE;
        const biome = biomeMap[columnIndex] as BiomeType;
        const config = BIOME_CONFIG[biome];
        const surfaceY = heightmap[columnIndex];

        // Skip if underwater
        if (surfaceY < seaLevel) {
          continue;
        }

        // Tree placement with noise-based probability
        const treeValue = this._treeNoise.noise2D(wx * 0.5, wz * 0.5);
        const treeProbability = (treeValue + 1) / 2;

        if (treeProbability < config.foliageDensity) {
          // Need enough space within chunk borders for a tree (2 block margin)
          if (lx >= 2 && lx < CHUNK_SIZE - 2 && lz >= 2 && lz < CHUNK_SIZE - 2) {
            this._placeTree(decorated, lx, surfaceY + 1, lz, config.treeType);
          }
        } else {
          // Small decorations: flowers, mushrooms
          const decorValue = this._decorNoise.noise2D(wx * 1.5, wz * 1.5);
          if (decorValue > 0.6 && config.foliageDensity > 0) {
            if (biome === BiomeType.SWAMP || biome === BiomeType.JUNGLE) {
              const idx = getBlockIndex(lx, surfaceY + 1, lz);
              if (surfaceY + 1 < CHUNK_HEIGHT && decorated[idx] === BlockId.AIR) {
                decorated[idx] = BlockId.MUSHROOM;
              }
            }
          }
        }
      }
    }

    return decorated;
  }

  private _placeTree(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
    treeType: string,
  ): void {
    if (baseY + 7 >= CHUNK_HEIGHT) {
      return;
    }

    switch (treeType) {
      case 'oak':
      case 'birch':
        this._placeOakTree(blocks, lx, baseY, lz);
        break;
      case 'spruce':
        this._placeSpruceTree(blocks, lx, baseY, lz);
        break;
      case 'palm':
        this._placePalmTree(blocks, lx, baseY, lz);
        break;
      case 'jungle':
        this._placeJungleTree(blocks, lx, baseY, lz);
        break;
      case 'cactus':
        this._placeCactus(blocks, lx, baseY, lz);
        break;
      default:
        break;
    }
  }

  private _placeOakTree(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
  ): void {
    const trunkHeight = 4 + Math.floor(this._treeNoise.noise2D(lx * 10, lz * 10) * 1.5 + 1.5);

    // Trunk
    for (let y = 0; y < trunkHeight; y++) {
      const idx = getBlockIndex(lx, baseY + y, lz);
      blocks[idx] = BlockId.WOOD;
    }

    // Canopy (sphere-ish shape)
    const canopyBase = baseY + trunkHeight - 1;
    const canopyRadius = 2;

    for (let dy = 0; dy <= 3; dy++) {
      const radius = dy === 0 || dy === 3 ? 1 : canopyRadius;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dz * dz > radius * radius + 1) {
            continue;
          }
          const px = lx + dx;
          const py = canopyBase + dy;
          const pz = lz + dz;

          if (px < 0 || px >= CHUNK_SIZE || pz < 0 || pz >= CHUNK_SIZE || py >= CHUNK_HEIGHT) {
            continue;
          }

          const idx = getBlockIndex(px, py, pz);
          if (blocks[idx] === BlockId.AIR) {
            blocks[idx] = BlockId.LEAVES;
          }
        }
      }
    }
  }

  private _placeSpruceTree(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
  ): void {
    const trunkHeight = 6;

    // Trunk
    for (let y = 0; y < trunkHeight; y++) {
      const idx = getBlockIndex(lx, baseY + y, lz);
      blocks[idx] = BlockId.WOOD;
    }

    // Conical canopy
    for (let layer = 0; layer < 4; layer++) {
      const y = baseY + trunkHeight - 1 - layer;
      const radius = layer;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) {
            continue;
          }
          const px = lx + dx;
          const pz = lz + dz;

          if (px < 0 || px >= CHUNK_SIZE || pz < 0 || pz >= CHUNK_SIZE || y >= CHUNK_HEIGHT) {
            continue;
          }

          const idx = getBlockIndex(px, y, pz);
          if (blocks[idx] === BlockId.AIR) {
            blocks[idx] = BlockId.LEAVES;
          }
        }
      }
    }

    // Top leaf
    if (baseY + trunkHeight < CHUNK_HEIGHT) {
      const topIdx = getBlockIndex(lx, baseY + trunkHeight, lz);
      blocks[topIdx] = BlockId.LEAVES;
    }
  }

  private _placePalmTree(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
  ): void {
    const trunkHeight = 5;

    for (let y = 0; y < trunkHeight; y++) {
      const idx = getBlockIndex(lx, baseY + y, lz);
      blocks[idx] = BlockId.WOOD;
    }

    // Frond-like top: 4 directions
    const topY = baseY + trunkHeight;
    if (topY < CHUNK_HEIGHT) {
      const topIdx = getBlockIndex(lx, topY, lz);
      blocks[topIdx] = BlockId.LEAVES;
    }

    const directions = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 },
    ];

    for (const dir of directions) {
      for (let i = 1; i <= 2; i++) {
        const px = lx + dir.dx * i;
        const pz = lz + dir.dz * i;
        const py = topY - (i === 2 ? 1 : 0);

        if (px >= 0 && px < CHUNK_SIZE && pz >= 0 && pz < CHUNK_SIZE && py < CHUNK_HEIGHT) {
          const idx = getBlockIndex(px, py, pz);
          if (blocks[idx] === BlockId.AIR) {
            blocks[idx] = BlockId.LEAVES;
          }
        }
      }
    }
  }

  private _placeJungleTree(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
  ): void {
    const trunkHeight = 7;

    for (let y = 0; y < trunkHeight; y++) {
      const idx = getBlockIndex(lx, baseY + y, lz);
      blocks[idx] = BlockId.WOOD;
    }

    // Large canopy
    const canopyBase = baseY + trunkHeight - 2;
    for (let dy = 0; dy <= 3; dy++) {
      const radius = dy === 0 || dy === 3 ? 1 : 3;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dz * dz > radius * radius + 1) {
            continue;
          }
          const px = lx + dx;
          const py = canopyBase + dy;
          const pz = lz + dz;

          if (px < 0 || px >= CHUNK_SIZE || pz < 0 || pz >= CHUNK_SIZE || py >= CHUNK_HEIGHT) {
            continue;
          }

          const idx = getBlockIndex(px, py, pz);
          if (blocks[idx] === BlockId.AIR) {
            blocks[idx] = BlockId.LEAVES;
          }
        }
      }
    }
  }

  private _placeCactus(
    blocks: Uint8Array,
    lx: number,
    baseY: number,
    lz: number,
  ): void {
    const height = 2 + Math.floor(Math.abs(this._treeNoise.noise2D(lx * 20, lz * 20)) * 2);

    for (let y = 0; y < height && baseY + y < CHUNK_HEIGHT; y++) {
      const idx = getBlockIndex(lx, baseY + y, lz);
      blocks[idx] = BlockId.CACTUS;
    }
  }
}
