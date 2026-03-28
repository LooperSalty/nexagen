// Types
export type {
  BlockType,
  ChunkData,
  WorldSeed,
  WorldParams,
  WorldManifest,
  ChunkCoord,
} from './types/world';
export { BiomeType, CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE, LOD_DISTANCES } from './types/world';

export type {
  Entity,
  CreatureStats,
  NPCData,
  Vector3Like,
} from './types/entity';
export { EntityType } from './types/entity';

export type {
  PlayerState,
  InputState,
  ItemStack,
  Item,
  ItemRarity,
} from './types/player';
export { ItemType } from './types/player';

export type {
  Quest,
  QuestObjective,
  QuestReward,
  QuestState,
} from './types/quest';
export { QuestType } from './types/quest';

export type {
  ClientEvent,
  ServerEvent,
  PlayerInfo,
  GenerationProgress,
} from './types/network';
export { GenerationStatus } from './types/network';

// Constants
export { BLOCK_DEFINITIONS, BlockId } from './constants/blocks';
export { BIOME_CONFIG } from './constants/biomes';
export {
  MAX_PLAYERS_PER_ROOM,
  TICK_RATE,
  PHYSICS_STEP,
  INTERACTION_DISTANCE,
  GRAVITY,
  PLAYER_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_FORCE,
  DAY_DURATION,
  MAX_INVENTORY_SLOTS,
  HOTBAR_SIZE,
  CHAT_MAX_LENGTH,
  PLAYER_REACH,
  FALL_DAMAGE_THRESHOLD,
  FALL_DAMAGE_MULTIPLIER,
  RESPAWN_INVINCIBILITY,
  XP_PER_LEVEL_BASE,
  XP_LEVEL_MULTIPLIER,
} from './constants/config';

// Utils
export {
  vec3Add,
  vec3Sub,
  vec3Scale,
  vec3Dot,
  vec3Cross,
  vec3Normalize,
  vec3Length,
  vec3Distance,
  lerp,
  clamp,
  smoothstep,
  remap,
  worldToChunk,
  chunkToWorld,
  blockToLocal,
  getChunkKey,
} from './utils/math';

export { SimplexNoise } from './utils/noise';

export {
  createEmptyChunk,
  getBlockIndex,
  getBlock,
  setBlock,
  isInBounds,
  getNeighborChunkCoords,
  getSpiralOrder,
} from './utils/chunk-utils';

export {
  compressChunk,
  decompressChunk,
  encodePosition,
  decodePosition,
} from './utils/serialization';
