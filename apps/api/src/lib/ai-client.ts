const TERRAIN_SERVICE_URL = process.env.TERRAIN_SERVICE_URL ?? 'http://localhost:5001';
const CREATURE_SERVICE_URL = process.env.CREATURE_SERVICE_URL ?? 'http://localhost:5002';
const NARRATIVE_SERVICE_URL = process.env.NARRATIVE_SERVICE_URL ?? 'http://localhost:5003';

const DEFAULT_TIMEOUT_MS = 30_000;
const DIALOGUE_TIMEOUT_MS = 10_000;

interface ServiceError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

class AIServiceError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(error: ServiceError) {
    super(error.message);
    this.name = 'AIServiceError';
    this.code = error.code;
    this.details = error.details;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorBody: ServiceError;
    try {
      errorBody = await response.json() as ServiceError;
    } catch {
      errorBody = {
        code: 'SERVICE_ERROR',
        message: `Service returned status ${response.status}`,
      };
    }
    throw new AIServiceError(errorBody);
  }

  return response.json() as Promise<T>;
}

export interface TerrainGenerationParams {
  readonly octaves?: number;
  readonly persistence?: number;
  readonly lacunarity?: number;
  readonly scale?: number;
}

export interface TerrainResult {
  readonly heightmap: readonly number[];
  readonly biomeMap: readonly number[];
  readonly structures: readonly {
    readonly type: string;
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
  }[];
  readonly metadata: {
    readonly generationTimeMs: number;
    readonly chunkCount: number;
  };
}

export async function generateTerrain(
  prompt: string,
  seed: number,
  size: number,
  params?: TerrainGenerationParams,
): Promise<TerrainResult> {
  const response = await fetchWithTimeout(
    `${TERRAIN_SERVICE_URL}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, seed, size, params: params ?? {} }),
    },
    DEFAULT_TIMEOUT_MS,
  );

  return handleResponse<TerrainResult>(response);
}

export interface CreatureResult {
  readonly creatures: readonly {
    readonly id: string;
    readonly name: string;
    readonly meshUrl: string;
    readonly stats: {
      readonly hp: number;
      readonly maxHp: number;
      readonly speed: number;
      readonly damage: number;
      readonly defense: number;
      readonly diet: string;
      readonly aggression: number;
      readonly sociability: number;
    };
    readonly spawnPosition: { readonly x: number; readonly y: number; readonly z: number };
  }[];
}

export async function generateCreatures(
  worldId: string,
  biome: string,
  role: string,
  size: number,
  count: number,
): Promise<CreatureResult> {
  const response = await fetchWithTimeout(
    `${CREATURE_SERVICE_URL}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldId, biome, role, size, count }),
    },
    DEFAULT_TIMEOUT_MS,
  );

  return handleResponse<CreatureResult>(response);
}

export interface NarrativeResult {
  readonly quests: readonly {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly objectives: readonly { readonly type: string; readonly target: string; readonly count: number }[];
    readonly rewards: readonly { readonly type: string; readonly itemId: string; readonly quantity: number }[];
  }[];
  readonly npcs: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: string;
    readonly personality: string;
    readonly backstory: string;
    readonly dialogueStyle: string;
    readonly position: { readonly x: number; readonly y: number; readonly z: number };
  }[];
  readonly lore: string;
}

export async function generateNarrative(
  worldId: string,
  description: string,
  biomes: readonly string[],
  structures: readonly string[],
): Promise<NarrativeResult> {
  const response = await fetchWithTimeout(
    `${NARRATIVE_SERVICE_URL}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldId, description, biomes, structures }),
    },
    DEFAULT_TIMEOUT_MS,
  );

  return handleResponse<NarrativeResult>(response);
}

export interface DialogueResult {
  readonly response: string;
  readonly mood: number;
  readonly relationship: number;
  readonly actions: readonly {
    readonly type: string;
    readonly target: string;
    readonly data: Record<string, unknown>;
  }[];
}

export async function npcDialogue(
  npcId: string,
  message: string,
  context: {
    readonly worldId: string;
    readonly playerName: string;
    readonly npcData: {
      readonly name: string;
      readonly role: string;
      readonly personality: string;
      readonly backstory: string;
      readonly mood: number;
      readonly relationship: number;
    };
    readonly recentMessages: readonly { readonly role: string; readonly content: string }[];
  },
): Promise<DialogueResult> {
  const response = await fetchWithTimeout(
    `${NARRATIVE_SERVICE_URL}/dialogue`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId, message, context }),
    },
    DIALOGUE_TIMEOUT_MS,
  );

  return handleResponse<DialogueResult>(response);
}

export { AIServiceError };
