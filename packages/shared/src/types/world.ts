export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256;
export const RENDER_DISTANCE = 8;
export const LOD_DISTANCES: readonly number[] = [2, 4, 6, 8] as const;

export interface BlockType {
  readonly id: number;
  readonly name: string;
  readonly transparent: boolean;
  readonly solid: boolean;
  readonly textures: {
    readonly top: number;
    readonly bottom: number;
    readonly sides: number;
  };
  readonly emissive: boolean;
}

export interface ChunkData {
  readonly position: ChunkCoord;
  readonly blocks: Uint8Array;
  readonly heightmap: Uint16Array;
  readonly biomeMap: Uint8Array;
  readonly meshDirty: boolean;
  readonly lodLevel: number;
}

export interface WorldSeed {
  readonly seed: number;
  readonly biomeScale: number;
  readonly heightScale: number;
  readonly seaLevel: number;
  readonly treeFrequency: number;
}

export enum BiomeType {
  OCEAN = 0,
  BEACH = 1,
  PLAINS = 2,
  FOREST = 3,
  DESERT = 4,
  MOUNTAINS = 5,
  SNOW = 6,
  SWAMP = 7,
  JUNGLE = 8,
  SAVANNA = 9,
}

export interface WorldParams {
  readonly name: string;
  readonly description: string;
  readonly seed: WorldSeed;
  readonly theme: string;
  readonly biomeDistribution: ReadonlyMap<BiomeType, number>;
  readonly specialFeatures: readonly string[];
  readonly ambientColor: string;
  readonly fogColor: string;
  readonly fogDensity: number;
  readonly skyGradient: readonly string[];
  readonly musicStyle: string;
}

export interface WorldManifest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly seed: WorldSeed;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly chunkCount: number;
  readonly playerCount: number;
  readonly theme: string;
  readonly thumbnailUrl: string | null;
}

export type ChunkCoord = {
  readonly cx: number;
  readonly cz: number;
};
