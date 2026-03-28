import type { Vector3Like } from './entity';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export enum ItemType {
  BLOCK = 'BLOCK',
  TOOL = 'TOOL',
  CONSUMABLE = 'CONSUMABLE',
  MATERIAL = 'MATERIAL',
  QUEST = 'QUEST',
  ARMOR = 'ARMOR',
}

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly type: ItemType;
  readonly stackable: boolean;
  readonly maxStack: number;
  readonly rarity: ItemRarity;
  readonly icon: string;
  readonly description: string;
  readonly stats?: Readonly<Record<string, number>>;
}

export interface ItemStack {
  readonly item: Item;
  readonly quantity: number;
}

export interface PlayerState {
  readonly position: Vector3Like;
  readonly rotation: Vector3Like;
  readonly hp: number;
  readonly maxHp: number;
  readonly inventory: readonly (ItemStack | null)[];
  readonly hotbarSlot: number;
  readonly questProgress: readonly string[];
  readonly playTime: number;
}

export interface InputState {
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
  readonly sprint: boolean;
  readonly interact: boolean;
  readonly inventory: boolean;
  readonly attack: boolean;
  readonly placeBlock: boolean;
  readonly mouseDelta: { readonly x: number; readonly y: number };
  readonly selectedSlot: number;
}
