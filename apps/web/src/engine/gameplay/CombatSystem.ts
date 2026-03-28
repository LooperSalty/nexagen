import type { Vector3Like } from '@nexagen/shared';
import { vec3Sub, vec3Normalize, vec3Scale } from '@nexagen/shared';

export interface CombatStats {
  readonly attackPower: number;
  readonly defense: number;
  readonly critChance: number;
  readonly attackSpeed: number;
}

export interface DamageResult {
  readonly damage: number;
  readonly isCrit: boolean;
  readonly knockbackDir: Vector3Like;
  readonly knockbackForce: number;
}

const BASE_CRIT_CHANCE = 0.05;
const CHARGED_MULTIPLIER = 1.5;
const DEFAULT_BLOCK_EFFICIENCY = 0.6;
const BASE_KNOCKBACK_FORCE = 5;
const CRIT_KNOCKBACK_BONUS = 1.5;

export function calculateDamage(
  attacker: CombatStats,
  target: CombatStats,
  charged: boolean,
  attackerPos: Vector3Like = { x: 0, y: 0, z: 0 },
  targetPos: Vector3Like = { x: 0, y: 0, z: 0 },
): DamageResult {
  // Crit roll
  const critChance = BASE_CRIT_CHANCE + attacker.critChance;
  const critRoll = Math.random();
  const isCrit = critRoll < critChance;

  // Base damage calculation
  const defenseReduction = target.defense * 0.5;
  let rawDamage = attacker.attackPower - defenseReduction;

  // Minimum damage floor
  rawDamage = Math.max(rawDamage, 1);

  // Apply charged bonus
  if (charged) {
    rawDamage *= CHARGED_MULTIPLIER;
  }

  // Apply crit multiplier
  const critMultiplier = isCrit ? 2.0 : 1.0;
  const finalDamage = Math.round(rawDamage * critMultiplier * 100) / 100;

  // Knockback direction: from attacker toward target
  const diff = vec3Sub(targetPos, attackerPos);
  const horizontal: Vector3Like = { x: diff.x, y: 0, z: diff.z };
  const dir = vec3Normalize(horizontal);

  // If attacker and target are at same position, default knockback
  const knockbackDir =
    dir.x === 0 && dir.y === 0 && dir.z === 0
      ? { x: 0, y: 0.3, z: -1 }
      : { x: dir.x, y: 0.3, z: dir.z };

  const knockbackForce = BASE_KNOCKBACK_FORCE * (isCrit ? CRIT_KNOCKBACK_BONUS : 1.0);

  return {
    damage: finalDamage,
    isCrit,
    knockbackDir: vec3Normalize(knockbackDir),
    knockbackForce,
  };
}

export function calculateBlock(
  damage: number,
  blockEfficiency: number = DEFAULT_BLOCK_EFFICIENCY,
): number {
  const clampedEfficiency = Math.max(0, Math.min(1, blockEfficiency));
  const reducedDamage = damage * (1 - clampedEfficiency);
  return Math.round(reducedDamage * 100) / 100;
}

export function applyKnockback(
  targetPos: Vector3Like,
  attackerPos: Vector3Like,
  force: number,
): Vector3Like {
  const diff = vec3Sub(targetPos, attackerPos);
  const horizontal: Vector3Like = { x: diff.x, y: 0, z: diff.z };
  const dir = vec3Normalize(horizontal);

  // If at same position, apply a default direction
  if (dir.x === 0 && dir.y === 0 && dir.z === 0) {
    return { x: 0, y: force * 0.4, z: -force };
  }

  // Apply force with upward component
  return {
    x: dir.x * force,
    y: force * 0.4,
    z: dir.z * force,
  };
}

export function createDefaultCombatStats(): CombatStats {
  return {
    attackPower: 5,
    defense: 0,
    critChance: 0,
    attackSpeed: 1.0,
  };
}

export function calculateDPS(stats: CombatStats): number {
  const baseDamage = Math.max(stats.attackPower, 1);
  const critBonus = 1 + stats.critChance * 1.0; // crit does 2x, so average bonus is critChance * 1.0
  return baseDamage * critBonus * stats.attackSpeed;
}
