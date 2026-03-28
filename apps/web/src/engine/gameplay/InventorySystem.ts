import type { Item, ItemStack } from '@nexagen/shared';
import { MAX_INVENTORY_SLOTS, HOTBAR_SIZE } from '@nexagen/shared';

export interface InventoryState {
  readonly slots: readonly (ItemStack | null)[];
  readonly armorSlots: readonly (Item | null)[];
  readonly selectedSlot: number;
}

const ARMOR_SLOT_COUNT = 4; // Head, Chest, Legs, Feet

export function createInventory(): InventoryState {
  return {
    slots: Array.from({ length: MAX_INVENTORY_SLOTS }, () => null),
    armorSlots: Array.from({ length: ARMOR_SLOT_COUNT }, () => null),
    selectedSlot: 0,
  };
}

export function addItem(
  inv: InventoryState,
  item: Item,
  quantity: number,
): { inventory: InventoryState; overflow: number } {
  if (quantity <= 0) {
    return { inventory: inv, overflow: 0 };
  }

  let remaining = quantity;
  const newSlots = [...inv.slots];

  // Phase 1: try to stack into existing slots with same item
  if (item.stackable) {
    for (let i = 0; i < newSlots.length && remaining > 0; i++) {
      const slot = newSlots[i];
      if (slot && slot.item.id === item.id) {
        const spaceInSlot = item.maxStack - slot.quantity;
        if (spaceInSlot > 0) {
          const toAdd = Math.min(remaining, spaceInSlot);
          newSlots[i] = {
            item: slot.item,
            quantity: slot.quantity + toAdd,
          };
          remaining -= toAdd;
        }
      }
    }
  }

  // Phase 2: fill empty slots
  for (let i = 0; i < newSlots.length && remaining > 0; i++) {
    if (newSlots[i] === null) {
      const toAdd = item.stackable ? Math.min(remaining, item.maxStack) : 1;
      newSlots[i] = {
        item,
        quantity: toAdd,
      };
      remaining -= toAdd;
    }
  }

  return {
    inventory: {
      slots: newSlots,
      armorSlots: inv.armorSlots,
      selectedSlot: inv.selectedSlot,
    },
    overflow: remaining,
  };
}

export function removeItem(
  inv: InventoryState,
  slotIndex: number,
  quantity: number,
): InventoryState {
  if (slotIndex < 0 || slotIndex >= inv.slots.length) {
    return inv;
  }

  const slot = inv.slots[slotIndex];
  if (!slot) {
    return inv;
  }

  if (quantity <= 0) {
    return inv;
  }

  const newSlots = [...inv.slots];

  if (quantity >= slot.quantity) {
    // Remove entire stack
    newSlots[slotIndex] = null;
  } else {
    newSlots[slotIndex] = {
      item: slot.item,
      quantity: slot.quantity - quantity,
    };
  }

  return {
    slots: newSlots,
    armorSlots: inv.armorSlots,
    selectedSlot: inv.selectedSlot,
  };
}

export function moveItem(
  inv: InventoryState,
  from: number,
  to: number,
): InventoryState {
  if (
    from < 0 ||
    from >= inv.slots.length ||
    to < 0 ||
    to >= inv.slots.length ||
    from === to
  ) {
    return inv;
  }

  const newSlots = [...inv.slots];
  const fromSlot = newSlots[from];
  const toSlot = newSlots[to];

  // If both slots contain the same stackable item, merge them
  if (
    fromSlot &&
    toSlot &&
    fromSlot.item.id === toSlot.item.id &&
    fromSlot.item.stackable
  ) {
    const totalQuantity = fromSlot.quantity + toSlot.quantity;
    const maxStack = fromSlot.item.maxStack;

    if (totalQuantity <= maxStack) {
      newSlots[to] = {
        item: toSlot.item,
        quantity: totalQuantity,
      };
      newSlots[from] = null;
    } else {
      newSlots[to] = {
        item: toSlot.item,
        quantity: maxStack,
      };
      newSlots[from] = {
        item: fromSlot.item,
        quantity: totalQuantity - maxStack,
      };
    }
  } else {
    // Swap
    newSlots[from] = toSlot;
    newSlots[to] = fromSlot;
  }

  return {
    slots: newSlots,
    armorSlots: inv.armorSlots,
    selectedSlot: inv.selectedSlot,
  };
}

export function getHotbarItem(inv: InventoryState): Item | null {
  const slot = inv.slots[inv.selectedSlot];
  return slot ? slot.item : null;
}

export function findItemSlot(inv: InventoryState, itemId: string): number {
  for (let i = 0; i < inv.slots.length; i++) {
    const slot = inv.slots[i];
    if (slot && slot.item.id === itemId) {
      return i;
    }
  }
  return -1;
}

export function setSelectedSlot(
  inv: InventoryState,
  slotIndex: number,
): InventoryState {
  const clamped = Math.max(0, Math.min(HOTBAR_SIZE - 1, slotIndex));
  if (clamped === inv.selectedSlot) {
    return inv;
  }
  return {
    slots: inv.slots,
    armorSlots: inv.armorSlots,
    selectedSlot: clamped,
  };
}

export function setArmorSlot(
  inv: InventoryState,
  slotIndex: number,
  item: Item | null,
): InventoryState {
  if (slotIndex < 0 || slotIndex >= inv.armorSlots.length) {
    return inv;
  }

  const newArmorSlots = [...inv.armorSlots];
  newArmorSlots[slotIndex] = item;

  return {
    slots: inv.slots,
    armorSlots: newArmorSlots,
    selectedSlot: inv.selectedSlot,
  };
}

export function getInventoryItemCount(inv: InventoryState, itemId: string): number {
  let total = 0;
  for (const slot of inv.slots) {
    if (slot && slot.item.id === itemId) {
      total += slot.quantity;
    }
  }
  return total;
}
