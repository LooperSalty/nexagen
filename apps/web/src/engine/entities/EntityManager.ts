import type { Entity, Vector3Like } from '@nexagen/shared';
import { vec3Distance } from '@nexagen/shared';

const DESPAWN_DISTANCE = 200;

export interface EntityInstance {
  readonly data: Entity;
  readonly mesh: unknown | null;
  readonly behaviorState: Readonly<Record<string, unknown>>;
}

export class EntityManager {
  private readonly _entities: Map<string, EntityInstance> = new Map();
  private _nextId: number = 0;

  get entityCount(): number {
    return this._entities.size;
  }

  spawn(entity: Entity): string {
    const id = entity.id || this._generateId();
    const instance: EntityInstance = {
      data: entity,
      mesh: null,
      behaviorState: {},
    };
    this._entities.set(id, instance);
    return id;
  }

  despawn(id: string): void {
    this._entities.delete(id);
  }

  update(deltaTime: number, playerPos: Vector3Like): void {
    const toDespawn: string[] = [];

    for (const [id, instance] of this._entities) {
      // Basic behavior tick: update AI state based on distance to player
      const dist = vec3Distance(instance.data.position, playerPos);

      if (dist > DESPAWN_DISTANCE) {
        toDespawn.push(id);
        continue;
      }

      // Simple behavior: if creature has stats, apply basic AI
      if (instance.data.stats) {
        const updatedBehavior = this._tickCreatureBehavior(
          instance,
          playerPos,
          deltaTime,
        );

        if (updatedBehavior !== instance.behaviorState) {
          const updatedInstance: EntityInstance = {
            data: instance.data,
            mesh: instance.mesh,
            behaviorState: updatedBehavior,
          };
          this._entities.set(id, updatedInstance);
        }
      }
    }

    for (const id of toDespawn) {
      this._entities.delete(id);
    }
  }

  getEntitiesInRadius(pos: Vector3Like, radius: number): Entity[] {
    const results: Entity[] = [];
    const radiusSq = radius * radius;

    for (const [, instance] of this._entities) {
      const dx = instance.data.position.x - pos.x;
      const dy = instance.data.position.y - pos.y;
      const dz = instance.data.position.z - pos.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq <= radiusSq) {
        results.push(instance.data);
      }
    }

    return results;
  }

  getEntity(id: string): EntityInstance | undefined {
    return this._entities.get(id);
  }

  getAllEntities(): ReadonlyMap<string, EntityInstance> {
    return this._entities;
  }

  private _generateId(): string {
    this._nextId += 1;
    return `entity_${this._nextId}_${Date.now()}`;
  }

  private _tickCreatureBehavior(
    instance: EntityInstance,
    playerPos: Vector3Like,
    deltaTime: number,
  ): Readonly<Record<string, unknown>> {
    const stats = instance.data.stats;
    if (!stats) {
      return instance.behaviorState;
    }

    const dist = vec3Distance(instance.data.position, playerPos);
    const aggression = stats.aggression;

    // State machine: idle -> alert -> chase (or flee)
    const currentState = (instance.behaviorState['state'] as string) ?? 'idle';
    const stateTimer = (instance.behaviorState['stateTimer'] as number) ?? 0;

    let newState = currentState;
    let newTimer = stateTimer + deltaTime;

    const alertDistance = 15;
    const chaseDistance = 10;
    const fleeDistance = 8;

    switch (currentState) {
      case 'idle':
        if (dist < alertDistance) {
          newState = 'alert';
          newTimer = 0;
        }
        break;

      case 'alert':
        if (dist > alertDistance * 1.5) {
          newState = 'idle';
          newTimer = 0;
        } else if (newTimer > 1.5) {
          if (aggression > 0.5 && dist < chaseDistance) {
            newState = 'chase';
          } else if (aggression < 0.3 && dist < fleeDistance) {
            newState = 'flee';
          } else {
            newState = 'idle';
          }
          newTimer = 0;
        }
        break;

      case 'chase':
        if (dist > chaseDistance * 2) {
          newState = 'idle';
          newTimer = 0;
        }
        break;

      case 'flee':
        if (dist > fleeDistance * 3) {
          newState = 'idle';
          newTimer = 0;
        }
        break;

      default:
        newState = 'idle';
        newTimer = 0;
    }

    if (newState === currentState && newTimer === stateTimer + deltaTime) {
      // Only create new object if something actually changed meaningfully
      return {
        ...instance.behaviorState,
        stateTimer: newTimer,
      };
    }

    return {
      ...instance.behaviorState,
      state: newState,
      stateTimer: newTimer,
    };
  }
}
