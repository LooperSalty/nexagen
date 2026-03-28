import type { Quest, QuestState } from '@nexagen/shared';

// --- Game event discriminated union ---

export type GameEvent =
  | { readonly type: 'kill'; readonly target: string }
  | { readonly type: 'collect'; readonly item: string; readonly count: number }
  | { readonly type: 'explore'; readonly location: string }
  | { readonly type: 'interact'; readonly npcId: string };

// --- Quest manager state (immutable) ---

export interface QuestManagerState {
  readonly activeQuests: ReadonlyMap<string, QuestState>;
  readonly completedQuests: ReadonlySet<string>;
}

export function createQuestManager(): QuestManagerState {
  return {
    activeQuests: new Map<string, QuestState>(),
    completedQuests: new Set<string>(),
  };
}

export function startQuest(
  state: QuestManagerState,
  quest: Quest,
): QuestManagerState {
  // Don't start if already active or completed
  if (state.activeQuests.has(quest.id) || state.completedQuests.has(quest.id)) {
    return state;
  }

  // Check prerequisite
  if (quest.prerequisiteId && !state.completedQuests.has(quest.prerequisiteId)) {
    return state;
  }

  const questState: QuestState = {
    questId: quest.id,
    status: 'active',
    objectiveProgress: quest.objectives.map(() => 0),
  };

  const newActiveQuests = new Map(state.activeQuests);
  newActiveQuests.set(quest.id, questState);

  return {
    activeQuests: newActiveQuests,
    completedQuests: state.completedQuests,
  };
}

export function updateObjective(
  state: QuestManagerState,
  questId: string,
  objectiveIndex: number,
  progress: number,
): QuestManagerState {
  const questState = state.activeQuests.get(questId);
  if (!questState || questState.status !== 'active') {
    return state;
  }

  if (objectiveIndex < 0 || objectiveIndex >= questState.objectiveProgress.length) {
    return state;
  }

  const newProgress = [...questState.objectiveProgress];
  newProgress[objectiveIndex] = Math.max(newProgress[objectiveIndex], progress);

  const updatedQuestState: QuestState = {
    questId: questState.questId,
    status: questState.status,
    objectiveProgress: newProgress,
  };

  const newActiveQuests = new Map(state.activeQuests);
  newActiveQuests.set(questId, updatedQuestState);

  return {
    activeQuests: newActiveQuests,
    completedQuests: state.completedQuests,
  };
}

export function completeQuest(
  state: QuestManagerState,
  questId: string,
): QuestManagerState {
  const questState = state.activeQuests.get(questId);
  if (!questState) {
    return state;
  }

  const newActiveQuests = new Map(state.activeQuests);
  newActiveQuests.delete(questId);

  const newCompletedQuests = new Set(state.completedQuests);
  newCompletedQuests.add(questId);

  return {
    activeQuests: newActiveQuests,
    completedQuests: newCompletedQuests,
  };
}

export function checkObjectives(
  state: QuestManagerState,
  event: GameEvent,
  questDefinitions: ReadonlyMap<string, Quest>,
): QuestManagerState {
  let currentState = state;

  for (const [questId, questState] of state.activeQuests) {
    if (questState.status !== 'active') {
      continue;
    }

    const quest = questDefinitions.get(questId);
    if (!quest) {
      continue;
    }

    for (let i = 0; i < quest.objectives.length; i++) {
      const objective = quest.objectives[i];

      if (objective.completed) {
        continue;
      }

      const currentProgress = questState.objectiveProgress[i];

      switch (event.type) {
        case 'kill': {
          if (objective.type === 'kill' && objective.target === event.target) {
            currentState = updateObjective(
              currentState,
              questId,
              i,
              currentProgress + 1,
            );
          }
          break;
        }

        case 'collect': {
          if (objective.type === 'collect' && objective.target === event.item) {
            currentState = updateObjective(
              currentState,
              questId,
              i,
              currentProgress + event.count,
            );
          }
          break;
        }

        case 'explore': {
          if (objective.type === 'explore' && objective.target === event.location) {
            currentState = updateObjective(
              currentState,
              questId,
              i,
              objective.count, // Exploring is binary: you visit or you don't
            );
          }
          break;
        }

        case 'interact': {
          if (objective.type === 'interact' && objective.target === event.npcId) {
            currentState = updateObjective(
              currentState,
              questId,
              i,
              objective.count,
            );
          }
          break;
        }
      }
    }

    // After processing the event, check if all objectives are met
    const updatedQuestState = currentState.activeQuests.get(questId);
    if (updatedQuestState) {
      const allComplete = quest.objectives.every((obj, idx) => {
        return updatedQuestState.objectiveProgress[idx] >= obj.count;
      });

      if (allComplete) {
        currentState = completeQuest(currentState, questId);
      }
    }
  }

  return currentState;
}

export function getActiveQuests(state: QuestManagerState): QuestState[] {
  const results: QuestState[] = [];
  for (const [, questState] of state.activeQuests) {
    if (questState.status === 'active') {
      results.push(questState);
    }
  }
  return results;
}

export function isQuestComplete(state: QuestManagerState, questId: string): boolean {
  return state.completedQuests.has(questId);
}

export function isQuestActive(state: QuestManagerState, questId: string): boolean {
  const qs = state.activeQuests.get(questId);
  return qs !== undefined && qs.status === 'active';
}

export function getQuestProgress(
  state: QuestManagerState,
  questId: string,
  quest: Quest,
): number {
  const questState = state.activeQuests.get(questId);
  if (!questState) {
    return state.completedQuests.has(questId) ? 1 : 0;
  }

  if (quest.objectives.length === 0) {
    return 1;
  }

  let totalProgress = 0;
  for (let i = 0; i < quest.objectives.length; i++) {
    const objective = quest.objectives[i];
    const current = questState.objectiveProgress[i] ?? 0;
    totalProgress += Math.min(current / Math.max(objective.count, 1), 1);
  }

  return totalProgress / quest.objectives.length;
}
