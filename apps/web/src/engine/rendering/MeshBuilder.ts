import type { ChunkData } from '@nexagen/shared';
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  BLOCK_DEFINITIONS,
  BlockId,
  getBlockIndex,
  getBlock as getBlockFromChunk,
} from '@nexagen/shared';

export interface ChunkMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
}

export type NeighborChunks = {
  readonly posX?: ChunkData;
  readonly negX?: ChunkData;
  readonly posZ?: ChunkData;
  readonly negZ?: ChunkData;
};

// Face direction enum for indexing
const FACE_POS_X = 0;
const FACE_NEG_X = 1;
const FACE_POS_Y = 2;
const FACE_NEG_Y = 3;
const FACE_POS_Z = 4;
const FACE_NEG_Z = 5;

// Normal vectors per face
const FACE_NORMALS: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],  // +X
  [-1, 0, 0], // -X
  [0, 1, 0],  // +Y
  [0, -1, 0], // -Y
  [0, 0, 1],  // +Z
  [0, 0, -1], // -Z
];

const ATLAS_SIZE = 256;
const TILE_SIZE = 16;
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE;
const UV_TILE = 1 / TILES_PER_ROW;

function getTextureIndex(blockId: number, face: number): number {
  const def = BLOCK_DEFINITIONS[blockId];
  if (!def) return 0;

  switch (face) {
    case FACE_POS_Y:
      return def.textures.top;
    case FACE_NEG_Y:
      return def.textures.bottom;
    default:
      return def.textures.sides;
  }
}

function getUVForTile(tileIndex: number): readonly [number, number, number, number] {
  const col = tileIndex % TILES_PER_ROW;
  const row = Math.floor(tileIndex / TILES_PER_ROW);
  const u0 = col * UV_TILE;
  const v0 = row * UV_TILE;
  const u1 = u0 + UV_TILE;
  const v1 = v0 + UV_TILE;
  return [u0, v0, u1, v1] as const;
}

function isTransparent(blockId: number): boolean {
  if (blockId === BlockId.AIR) return true;
  const def = BLOCK_DEFINITIONS[blockId];
  return def ? def.transparent : true;
}

function getBlockAt(
  chunk: ChunkData,
  x: number,
  y: number,
  z: number,
  neighbors: NeighborChunks,
): number {
  if (y < 0 || y >= CHUNK_HEIGHT) {
    return BlockId.AIR;
  }

  if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
    return getBlockFromChunk(chunk, x, y, z);
  }

  // Cross-chunk boundary lookups
  if (x < 0 && neighbors.negX) {
    return getBlockFromChunk(neighbors.negX, x + CHUNK_SIZE, y, z);
  }
  if (x >= CHUNK_SIZE && neighbors.posX) {
    return getBlockFromChunk(neighbors.posX, x - CHUNK_SIZE, y, z);
  }
  if (z < 0 && neighbors.negZ) {
    return getBlockFromChunk(neighbors.negZ, x, y, z + CHUNK_SIZE);
  }
  if (z >= CHUNK_SIZE && neighbors.posZ) {
    return getBlockFromChunk(neighbors.posZ, x, y, z - CHUNK_SIZE);
  }

  return BlockId.AIR;
}

function isFaceVisible(
  chunk: ChunkData,
  x: number,
  y: number,
  z: number,
  face: number,
  neighbors: NeighborChunks,
): boolean {
  let nx = x;
  let ny = y;
  let nz = z;

  switch (face) {
    case FACE_POS_X: nx = x + 1; break;
    case FACE_NEG_X: nx = x - 1; break;
    case FACE_POS_Y: ny = y + 1; break;
    case FACE_NEG_Y: ny = y - 1; break;
    case FACE_POS_Z: nz = z + 1; break;
    case FACE_NEG_Z: nz = z - 1; break;
  }

  const neighborBlock = getBlockAt(chunk, nx, ny, nz, neighbors);
  return isTransparent(neighborBlock);
}

interface GreedyQuad {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly blockId: number;
  readonly face: number;
}

export function buildChunkMesh(
  chunk: ChunkData,
  neighbors: NeighborChunks,
): ChunkMeshData {
  const quads: GreedyQuad[] = [];

  // For each face direction, run greedy meshing on slices
  // +X / -X faces: iterate over X slices, merge in YZ plane
  for (let face = 0; face < 6; face++) {
    greedyMeshFace(chunk, neighbors, face, quads);
  }

  // Convert quads to geometry buffers
  const vertexCount = quads.length * 4;
  const indexCount = quads.length * 6;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint32Array(indexCount);

  let vi = 0; // vertex index
  let ii = 0; // index index

  for (const quad of quads) {
    const normal = FACE_NORMALS[quad.face];
    const tileIdx = getTextureIndex(quad.blockId, quad.face);
    const [u0, v0, u1, v1] = getUVForTile(tileIdx);

    // UV tiling for greedy merged quads
    const uScale = quad.w;
    const vScale = quad.h;
    const uEnd = u0 + (u1 - u0) * uScale;
    const vEnd = v0 + (v1 - v0) * vScale;

    const corners = getFaceCorners(quad);

    const baseVertex = vi;

    for (let c = 0; c < 4; c++) {
      const pos = corners[c];
      positions[vi * 3] = pos[0];
      positions[vi * 3 + 1] = pos[1];
      positions[vi * 3 + 2] = pos[2];

      normals[vi * 3] = normal[0];
      normals[vi * 3 + 1] = normal[1];
      normals[vi * 3 + 2] = normal[2];

      // UVs: map quad corners to texture coordinates
      const uVal = c === 0 || c === 3 ? u0 : uEnd;
      const vVal = c === 0 || c === 1 ? v0 : vEnd;
      uvs[vi * 2] = uVal;
      uvs[vi * 2 + 1] = vVal;

      vi++;
    }

    // Two triangles per quad
    indices[ii++] = baseVertex;
    indices[ii++] = baseVertex + 1;
    indices[ii++] = baseVertex + 2;
    indices[ii++] = baseVertex;
    indices[ii++] = baseVertex + 2;
    indices[ii++] = baseVertex + 3;
  }

  return {
    positions,
    normals,
    uvs,
    indices,
    vertexCount,
  };
}

function getFaceCorners(quad: GreedyQuad): readonly (readonly [number, number, number])[] {
  const { x, y, z, w, h, face } = quad;

  switch (face) {
    case FACE_POS_X:
      return [
        [x + 1, y, z],
        [x + 1, y, z + w],
        [x + 1, y + h, z + w],
        [x + 1, y + h, z],
      ];
    case FACE_NEG_X:
      return [
        [x, y, z + w],
        [x, y, z],
        [x, y + h, z],
        [x, y + h, z + w],
      ];
    case FACE_POS_Y:
      return [
        [x, y + 1, z],
        [x + w, y + 1, z],
        [x + w, y + 1, z + h],
        [x, y + 1, z + h],
      ];
    case FACE_NEG_Y:
      return [
        [x, y, z + h],
        [x + w, y, z + h],
        [x + w, y, z],
        [x, y, z],
      ];
    case FACE_POS_Z:
      return [
        [x + w, y, z + 1],
        [x, y, z + 1],
        [x, y + h, z + 1],
        [x + w, y + h, z + 1],
      ];
    case FACE_NEG_Z:
      return [
        [x, y, z],
        [x + w, y, z],
        [x + w, y + h, z],
        [x, y + h, z],
      ];
    default:
      return [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
  }
}

function greedyMeshFace(
  chunk: ChunkData,
  neighbors: NeighborChunks,
  face: number,
  quads: GreedyQuad[],
): void {
  // Determine axes for the slice plane
  // For each face, we slice along its normal axis and merge in the two tangent axes
  let sliceAxis: number; // 0=x, 1=y, 2=z
  let uAxis: number;
  let vAxis: number;
  let sliceSize: number;
  let uSize: number;
  let vSize: number;

  switch (face) {
    case FACE_POS_X:
    case FACE_NEG_X:
      sliceAxis = 0;
      uAxis = 2; // z
      vAxis = 1; // y
      sliceSize = CHUNK_SIZE;
      uSize = CHUNK_SIZE;
      vSize = CHUNK_HEIGHT;
      break;
    case FACE_POS_Y:
    case FACE_NEG_Y:
      sliceAxis = 1;
      uAxis = 0; // x
      vAxis = 2; // z
      sliceSize = CHUNK_HEIGHT;
      uSize = CHUNK_SIZE;
      vSize = CHUNK_SIZE;
      break;
    case FACE_POS_Z:
    case FACE_NEG_Z:
      sliceAxis = 2;
      uAxis = 0; // x
      vAxis = 1; // y
      sliceSize = CHUNK_SIZE;
      uSize = CHUNK_SIZE;
      vSize = CHUNK_HEIGHT;
      break;
    default:
      return;
  }

  // Mask stores which face-voxels in a slice are visible and their block type
  // 0 = no face, >0 = blockId
  const mask = new Int32Array(uSize * vSize);

  for (let slice = 0; slice < sliceSize; slice++) {
    // Build mask for this slice
    mask.fill(0);

    for (let v = 0; v < vSize; v++) {
      for (let u = 0; u < uSize; u++) {
        const coords = [0, 0, 0];
        coords[sliceAxis] = slice;
        coords[uAxis] = u;
        coords[vAxis] = v;

        const x = coords[0];
        const y = coords[1];
        const z = coords[2];

        const blockId = getBlockFromChunk(chunk, x, y, z);
        if (blockId === BlockId.AIR) {
          continue;
        }

        const def = BLOCK_DEFINITIONS[blockId];
        if (!def || def.transparent) {
          // For transparent blocks (water, leaves), only show faces against air
          if (def && blockId !== BlockId.AIR) {
            if (isFaceVisible(chunk, x, y, z, face, neighbors)) {
              const neighborCoords = [x, y, z];
              switch (face) {
                case FACE_POS_X: neighborCoords[0]++; break;
                case FACE_NEG_X: neighborCoords[0]--; break;
                case FACE_POS_Y: neighborCoords[1]++; break;
                case FACE_NEG_Y: neighborCoords[1]--; break;
                case FACE_POS_Z: neighborCoords[2]++; break;
                case FACE_NEG_Z: neighborCoords[2]--; break;
              }
              const nb = getBlockAt(chunk, neighborCoords[0], neighborCoords[1], neighborCoords[2], neighbors);
              // Don't merge same transparent blocks
              if (nb !== blockId) {
                mask[u + v * uSize] = blockId;
              }
            }
          }
          continue;
        }

        if (isFaceVisible(chunk, x, y, z, face, neighbors)) {
          mask[u + v * uSize] = blockId;
        }
      }
    }

    // Greedy merge the mask into rectangles
    for (let v = 0; v < vSize; v++) {
      let u = 0;
      while (u < uSize) {
        const blockId = mask[u + v * uSize];
        if (blockId === 0) {
          u++;
          continue;
        }

        // Find width (same blockId along u)
        let w = 1;
        while (u + w < uSize && mask[(u + w) + v * uSize] === blockId) {
          w++;
        }

        // Find height (same blockId rectangle along v)
        let h = 1;
        let canExtend = true;
        while (v + h < vSize && canExtend) {
          for (let du = 0; du < w; du++) {
            if (mask[(u + du) + (v + h) * uSize] !== blockId) {
              canExtend = false;
              break;
            }
          }
          if (canExtend) {
            h++;
          }
        }

        // Clear mask for merged region
        for (let dv = 0; dv < h; dv++) {
          for (let du = 0; du < w; du++) {
            mask[(u + du) + (v + dv) * uSize] = 0;
          }
        }

        // Build the quad coordinates
        const coords = [0, 0, 0];
        coords[sliceAxis] = slice;
        coords[uAxis] = u;
        coords[vAxis] = v;

        const quadW = face === FACE_POS_Y || face === FACE_NEG_Y
          ? w
          : (sliceAxis === 0 || sliceAxis === 2 ? w : w);
        const quadH = face === FACE_POS_Y || face === FACE_NEG_Y
          ? h
          : h;

        quads.push({
          x: coords[0],
          y: coords[1],
          z: coords[2],
          w: quadW,
          h: quadH,
          blockId,
          face,
        });

        u += w;
      }
    }
  }
}
