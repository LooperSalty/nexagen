import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WorldParams } from '@nexagen/shared';
import { GenerationStatus } from '@nexagen/shared';

interface WorldStoreState {
  readonly worldId: string | null;
  readonly seed: number | null;
  readonly worldParams: WorldParams | null;
  readonly status: GenerationStatus;
  readonly loadedChunks: number;
  readonly totalChunks: number;
  readonly timeOfDay: number;
}

interface WorldStoreActions {
  readonly setWorld: (worldId: string, seed: number, params: WorldParams) => void;
  readonly setStatus: (status: GenerationStatus) => void;
  readonly updateTime: (delta: number, dayDuration: number) => void;
  readonly setTimeOfDay: (time: number) => void;
  readonly updateChunkCount: (loaded: number, total?: number) => void;
  readonly reset: () => void;
}

type WorldStore = WorldStoreState & WorldStoreActions;

const INITIAL_STATE: WorldStoreState = {
  worldId: null,
  seed: null,
  worldParams: null,
  status: GenerationStatus.IDLE,
  loadedChunks: 0,
  totalChunks: 0,
  timeOfDay: 0.35,
};

export const useWorldStore = create<WorldStore>()(
  subscribeWithSelector((set) => ({
    ...INITIAL_STATE,

    setWorld: (worldId: string, seed: number, params: WorldParams) =>
      set({
        worldId,
        seed,
        worldParams: params,
        status: GenerationStatus.IDLE,
        loadedChunks: 0,
        totalChunks: 0,
      }),

    setStatus: (status: GenerationStatus) => set({ status }),

    updateTime: (delta: number, dayDuration: number) =>
      set((prev) => {
        const newTime = prev.timeOfDay + delta / dayDuration;
        return { timeOfDay: ((newTime % 1) + 1) % 1 };
      }),

    setTimeOfDay: (time: number) => set({ timeOfDay: ((time % 1) + 1) % 1 }),

    updateChunkCount: (loaded: number, total?: number) =>
      set((prev) => ({
        loadedChunks: loaded,
        ...(total !== undefined ? { totalChunks: total } : {}),
      })),

    reset: () => set(INITIAL_STATE),
  })),
);
