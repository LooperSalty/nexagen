import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Vector3Like, ItemStack } from '@nexagen/shared';
import { MAX_INVENTORY_SLOTS, HOTBAR_SIZE } from '@nexagen/shared';

interface InventoryState {
  readonly slots: readonly (ItemStack | null)[];
}

interface PlayerStoreState {
  readonly position: Vector3Like;
  readonly rotation: Vector3Like;
  readonly hp: number;
  readonly maxHp: number;
  readonly isGrounded: boolean;
  readonly isSprinting: boolean;
  readonly inventory: InventoryState;
  readonly selectedSlot: number;
}

interface PlayerStoreActions {
  readonly updatePosition: (position: Vector3Like) => void;
  readonly updateRotation: (rotation: Vector3Like) => void;
  readonly updateHealth: (hp: number, maxHp?: number) => void;
  readonly setGrounded: (grounded: boolean) => void;
  readonly setSprinting: (sprinting: boolean) => void;
  readonly updateInventory: (slots: readonly (ItemStack | null)[]) => void;
  readonly setInventorySlot: (index: number, stack: ItemStack | null) => void;
  readonly selectSlot: (slot: number) => void;
  readonly reset: () => void;
}

type PlayerStore = PlayerStoreState & PlayerStoreActions;

function createEmptyInventory(): InventoryState {
  return {
    slots: Array.from({ length: MAX_INVENTORY_SLOTS }, () => null),
  };
}

const INITIAL_STATE: PlayerStoreState = {
  position: { x: 0, y: 80, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  hp: 20,
  maxHp: 20,
  isGrounded: false,
  isSprinting: false,
  inventory: createEmptyInventory(),
  selectedSlot: 0,
};

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector((set) => ({
    ...INITIAL_STATE,

    updatePosition: (position: Vector3Like) => set({ position }),

    updateRotation: (rotation: Vector3Like) => set({ rotation }),

    updateHealth: (hp: number, maxHp?: number) =>
      set((prev) => ({
        hp: Math.max(0, Math.min(hp, maxHp ?? prev.maxHp)),
        ...(maxHp !== undefined ? { maxHp } : {}),
      })),

    setGrounded: (isGrounded: boolean) => set({ isGrounded }),

    setSprinting: (isSprinting: boolean) => set({ isSprinting }),

    updateInventory: (slots: readonly (ItemStack | null)[]) =>
      set({ inventory: { slots } }),

    setInventorySlot: (index: number, stack: ItemStack | null) =>
      set((prev) => {
        if (index < 0 || index >= MAX_INVENTORY_SLOTS) return prev;
        const newSlots = [...prev.inventory.slots];
        newSlots[index] = stack;
        return { inventory: { slots: newSlots } };
      }),

    selectSlot: (slot: number) => {
      if (slot >= 0 && slot < HOTBAR_SIZE) {
        set({ selectedSlot: slot });
      }
    },

    reset: () => set(INITIAL_STATE),
  })),
);

export type { InventoryState };
