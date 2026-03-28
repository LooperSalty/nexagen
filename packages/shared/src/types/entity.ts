export type Vector3Like = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export enum EntityType {
  CREATURE = 'CREATURE',
  NPC = 'NPC',
  ITEM_DROP = 'ITEM_DROP',
  INTERACTIVE = 'INTERACTIVE',
}

export interface Entity {
  readonly id: string;
  readonly type: EntityType;
  readonly name: string;
  readonly position: Vector3Like;
  readonly rotation: Vector3Like;
  readonly meshUrl: string;
  readonly stats: CreatureStats | null;
}

export interface CreatureStats {
  readonly hp: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly damage: number;
  readonly defense: number;
  readonly diet: 'herbivore' | 'carnivore' | 'omnivore';
  readonly aggression: number;
  readonly sociability: number;
}

export interface NPCData {
  readonly name: string;
  readonly role: string;
  readonly personality: string;
  readonly backstory: string;
  readonly knowledge: readonly string[];
  readonly dialogueStyle: string;
  readonly mood: number;
  readonly relationship: number;
}
