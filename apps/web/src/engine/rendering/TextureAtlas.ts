import * as THREE from 'three';
import { BLOCK_DEFINITIONS } from '@nexagen/shared';

export const ATLAS_SIZE = 256;
export const TILE_SIZE = 16;
export const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE;

const UV_UNIT = 1 / TILES_PER_ROW;

export function getUVs(tileIndex: number): readonly [number, number, number, number] {
  const col = tileIndex % TILES_PER_ROW;
  const row = Math.floor(tileIndex / TILES_PER_ROW);
  const u0 = col * UV_UNIT;
  const v0 = row * UV_UNIT;
  const u1 = u0 + UV_UNIT;
  const v1 = v0 + UV_UNIT;
  return [u0, v0, u1, v1] as const;
}

export async function loadAtlas(url: string): Promise<THREE.Texture> {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        const configured = texture.clone();
        configured.magFilter = THREE.NearestFilter;
        configured.minFilter = THREE.NearestFilter;
        configured.generateMipmaps = false;
        configured.colorSpace = THREE.SRGBColorSpace;
        configured.needsUpdate = true;
        resolve(configured);
      },
      undefined,
      (error) => {
        reject(new Error(`Failed to load texture atlas from ${url}: ${String(error)}`));
      },
    );
  });
}

// Procedural color palette for placeholder atlas tiles
const TILE_COLORS: readonly string[] = [
  'transparent', // 0: air
  '#4CAF50',     // 1: grass top
  '#6D8B40',     // 2: grass side
  '#8B6914',     // 3: dirt
  '#808080',     // 4: stone
  '#F5DEB3',     // 5: sand
  '#1565C0',     // 6: water
  '#6D4C41',     // 7: wood side
  '#8D6E63',     // 8: wood top
  '#2E7D32',     // 9: leaves
  '#ECEFF1',     // 10: snow top
  '#B0BEC5',     // 11: snow side
  '#9E9E9E',     // 12: gravel
  '#424242',     // 13: coal ore
  '#BF8040',     // 14: iron ore
  '#FFD700',     // 15: gold ore
  '#00BCD4',     // 16: diamond ore
  '#1A0033',     // 17: obsidian
  '#FF5722',     // 18: lava
  '#CE93D8',     // 19: crystal
  '#558B2F',     // 20: cactus side
  '#689F38',     // 21: cactus top
  '#D7CCC8',     // 22: mushroom
  '#D7B06E',     // 23: planks
] as const;

export function createPlaceholderAtlas(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for placeholder atlas');
  }

  // Fill background with magenta (easy to spot missing textures)
  ctx.fillStyle = '#FF00FF';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // Paint each tile
  for (let i = 0; i < TILE_COLORS.length; i++) {
    const color = TILE_COLORS[i];
    if (color === 'transparent') {
      continue;
    }

    const col = i % TILES_PER_ROW;
    const row = Math.floor(i / TILES_PER_ROW);
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Add a subtle border/detail to make tiles distinguishable
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x, y, TILE_SIZE, 1);
    ctx.fillRect(x, y, 1, TILE_SIZE);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
    ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);

    // Add noise pattern for texture detail
    for (let py = 0; py < TILE_SIZE; py += 2) {
      for (let px = 0; px < TILE_SIZE; px += 2) {
        const brightness = Math.random() * 0.1;
        ctx.fillStyle = `rgba(0,0,0,${brightness})`;
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}
