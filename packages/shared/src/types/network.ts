import type { Vector3Like } from './entity';
import type { ChunkCoord, ChunkData } from './world';
import type { Entity } from './entity';

export interface PlayerInfo {
  readonly id: string;
  readonly username: string;
  readonly position: Vector3Like;
  readonly rotation: Vector3Like;
  readonly skin: string;
}

export enum GenerationStatus {
  IDLE = 'IDLE',
  GENERATING_TERRAIN = 'GENERATING_TERRAIN',
  GENERATING_ENTITIES = 'GENERATING_ENTITIES',
  GENERATING_QUESTS = 'GENERATING_QUESTS',
  GENERATING_NPCS = 'GENERATING_NPCS',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface GenerationProgress {
  readonly status: GenerationStatus;
  readonly progress: number;
  readonly message: string;
}

// --- Client Events (client -> server) ---

export type ClientEvent =
  | {
      readonly type: 'player:move';
      readonly payload: {
        readonly position: Vector3Like;
        readonly rotation: Vector3Like;
        readonly velocity: Vector3Like;
        readonly grounded: boolean;
      };
    }
  | {
      readonly type: 'player:action';
      readonly payload: {
        readonly action: 'attack' | 'interact' | 'place' | 'break';
        readonly targetId: string | null;
        readonly position: Vector3Like | null;
        readonly blockId: number | null;
      };
    }
  | {
      readonly type: 'chat:message';
      readonly payload: {
        readonly message: string;
        readonly channel: 'global' | 'local' | 'whisper';
        readonly targetPlayerId: string | null;
      };
    }
  | {
      readonly type: 'world:request_chunks';
      readonly payload: {
        readonly chunks: readonly ChunkCoord[];
        readonly lodLevel: number;
      };
    };

// --- Server Events (server -> client) ---

export type ServerEvent =
  | {
      readonly type: 'player:update';
      readonly payload: {
        readonly id: string;
        readonly position: Vector3Like;
        readonly rotation: Vector3Like;
        readonly velocity: Vector3Like;
        readonly animation: string;
      };
    }
  | {
      readonly type: 'player:join';
      readonly payload: PlayerInfo;
    }
  | {
      readonly type: 'player:leave';
      readonly payload: {
        readonly id: string;
      };
    }
  | {
      readonly type: 'entity:update';
      readonly payload: {
        readonly id: string;
        readonly position: Vector3Like;
        readonly rotation: Vector3Like;
        readonly animation: string;
        readonly hp: number;
      };
    }
  | {
      readonly type: 'entity:spawn';
      readonly payload: Entity;
    }
  | {
      readonly type: 'entity:despawn';
      readonly payload: {
        readonly id: string;
      };
    }
  | {
      readonly type: 'world:chunk_data';
      readonly payload: {
        readonly chunk: ChunkData;
        readonly compressed: Uint8Array;
      };
    }
  | {
      readonly type: 'world:block_change';
      readonly payload: {
        readonly position: Vector3Like;
        readonly blockId: number;
        readonly previousBlockId: number;
      };
    }
  | {
      readonly type: 'chat:message';
      readonly payload: {
        readonly senderId: string;
        readonly senderName: string;
        readonly message: string;
        readonly channel: 'global' | 'local' | 'whisper';
        readonly timestamp: number;
      };
    }
  | {
      readonly type: 'game:notification';
      readonly payload: {
        readonly title: string;
        readonly message: string;
        readonly severity: 'info' | 'warning' | 'error' | 'success';
        readonly duration: number;
      };
    }
  | {
      readonly type: 'generation:progress';
      readonly payload: GenerationProgress;
    };
