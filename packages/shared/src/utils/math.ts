import type { Vector3Like } from '../types/entity';
import type { ChunkCoord } from '../types/world';
import { CHUNK_SIZE } from '../types/world';

export function vec3Add(a: Vector3Like, b: Vector3Like): Vector3Like {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Sub(a: Vector3Like, b: Vector3Like): Vector3Like {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Scale(v: Vector3Like, s: number): Vector3Like {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vec3Dot(a: Vector3Like, b: Vector3Like): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Cross(a: Vector3Like, b: Vector3Like): Vector3Like {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vec3Length(v: Vector3Like): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vec3Normalize(v: Vector3Like): Vector3Like {
  const len = vec3Length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function vec3Distance(a: Vector3Like, b: Vector3Like): number {
  return vec3Length(vec3Sub(a, b));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, t);
}

export function worldToChunk(x: number, z: number): ChunkCoord {
  return {
    cx: Math.floor(x / CHUNK_SIZE),
    cz: Math.floor(z / CHUNK_SIZE),
  };
}

export function chunkToWorld(cx: number, cz: number): { x: number; z: number } {
  return {
    x: cx * CHUNK_SIZE,
    z: cz * CHUNK_SIZE,
  };
}

export function blockToLocal(
  x: number,
  y: number,
  z: number,
): { lx: number; ly: number; lz: number } {
  return {
    lx: ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    ly: y,
    lz: ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  };
}

export function getChunkKey(cx: number, cz: number): string {
  return `${cx}:${cz}`;
}
