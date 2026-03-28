import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

type GameState = 'menu' | 'loading' | 'playing' | 'paused';

interface GameStoreState {
  readonly state: GameState;
  readonly fps: number;
  readonly debugMode: boolean;
}

interface GameStoreActions {
  readonly setState: (state: GameState) => void;
  readonly setFps: (fps: number) => void;
  readonly toggleDebug: () => void;
  readonly togglePause: () => void;
}

type GameStore = GameStoreState & GameStoreActions;

const INITIAL_STATE: GameStoreState = {
  state: 'menu',
  fps: 0,
  debugMode: false,
};

export const useGameStore = create<GameStore>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,

    setState: (state: GameState) => set({ state }),

    setFps: (fps: number) => set({ fps }),

    toggleDebug: () => set({ debugMode: !get().debugMode }),

    togglePause: () => {
      const current = get().state;
      if (current === 'playing') {
        set({ state: 'paused' });
      } else if (current === 'paused') {
        set({ state: 'playing' });
      }
    },
  })),
);
