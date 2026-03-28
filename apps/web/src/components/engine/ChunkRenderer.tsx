"use client";

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ChunkData } from "@nexagen/shared";
import { CHUNK_SIZE } from "@nexagen/shared";

interface ChunkMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly colors: Float32Array;
}

interface ChunkRendererProps {
  readonly chunk: ChunkData;
  readonly meshData: ChunkMeshData;
}

const terrainVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const terrainFragmentShader = `
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float ambientIntensity;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vec3 ambient = vColor * ambientIntensity;
    float diff = max(dot(vNormal, sunDirection), 0.0);
    vec3 diffuse = vColor * sunColor * diff;
    vec3 color = ambient + diffuse;

    float dist = length(vPosition - cameraPosition);
    float fogFactor = smoothstep(fogNear, fogFar, dist);
    color = mix(color, fogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function ChunkRendererInner({ chunk, meshData }: ChunkRendererProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (meshData.positions.length === 0) {
      return null;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(meshData.positions, 3),
    );
    geo.setAttribute(
      "normal",
      new THREE.BufferAttribute(meshData.normals, 3),
    );
    geo.setAttribute("uv", new THREE.BufferAttribute(meshData.uvs, 2));
    geo.setAttribute(
      "color",
      new THREE.BufferAttribute(meshData.colors, 3),
    );
    geo.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    geo.computeBoundingSphere();

    return geo;
  }, [meshData]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        sunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        sunColor: { value: new THREE.Vector3(1.0, 0.95, 0.85) },
        ambientIntensity: { value: 0.4 },
        fogColor: { value: new THREE.Vector3(0.6, 0.8, 1.0) },
        fogNear: { value: 50.0 },
        fogFar: { value: 200.0 },
      },
      vertexColors: true,
      side: THREE.FrontSide,
    });
  }, []);

  if (!geometry) {
    return null;
  }

  const worldX = chunk.position.cx * CHUNK_SIZE;
  const worldZ = chunk.position.cz * CHUNK_SIZE;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[worldX, 0, worldZ]}
      frustumCulled
    />
  );
}

function arePropsEqual(
  prev: ChunkRendererProps,
  next: ChunkRendererProps,
): boolean {
  return (
    prev.chunk.position.cx === next.chunk.position.cx &&
    prev.chunk.position.cz === next.chunk.position.cz &&
    prev.chunk.meshDirty === next.chunk.meshDirty &&
    prev.chunk.lodLevel === next.chunk.lodLevel &&
    prev.meshData === next.meshData
  );
}

const ChunkRenderer = memo(ChunkRendererInner, arePropsEqual);
ChunkRenderer.displayName = "ChunkRenderer";

export default ChunkRenderer;
export type { ChunkMeshData };
