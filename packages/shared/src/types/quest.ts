import type { Vector3Like } from './entity';

export enum QuestType {
  FETCH = 'FETCH',
  KILL = 'KILL',
  ESCORT = 'ESCORT',
  EXPLORE = 'EXPLORE',
  CRAFT = 'CRAFT',
  DIALOGUE = 'DIALOGUE',
  PUZZLE = 'PUZZLE',
}

export interface QuestObjective {
  readonly type: string;
  readonly target: string;
  readonly count: number;
  readonly location: Vector3Like | null;
  readonly completed: boolean;
}

export interface QuestReward {
  readonly xp: number;
  readonly items: readonly string[];
  readonly reputation: number;
  readonly unlocks: readonly string[];
}

export interface Quest {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly giverId: string;
  readonly type: QuestType;
  readonly objectives: readonly QuestObjective[];
  readonly rewards: QuestReward;
  readonly dialogue: {
    readonly intro: string;
    readonly progress: string;
    readonly completion: string;
  };
  readonly difficulty: number;
  readonly isMainQuest: boolean;
  readonly sortOrder: number;
  readonly prerequisiteId: string | null;
}

export interface QuestState {
  readonly questId: string;
  readonly status: 'active' | 'completed' | 'failed';
  readonly objectiveProgress: readonly number[];
}
