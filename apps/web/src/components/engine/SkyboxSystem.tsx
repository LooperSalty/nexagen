"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorldStore } from "../../stores/worldStore";
import { DAY_DURATION } from "@nexagen/shared";

interface SkyKeyframe {
  readonly time: number;
  readonly topColor: readonly [number, number, number];
  readonly horizonColor: readonly [number, number, number];
  readonly ambientIntensity: number;
  readonly directionalIntensity: number;
  readonly sunColor: readonly [number, number, number];
}

const SKY_KEYFRAMES: readonly SkyKeyframe[] = [
  { time: 0.0, topColor: [0.01, 0.01, 0.05], horizonColor: [0.02, 0.02, 0.08], ambientIntensity: 0.08, directionalIntensity: 0.02, sunColor: [0.1, 0.1, 0.2] },
  { time: 0.25, topColor: [0.2, 0.3, 0.6], horizonColor: [1.0, 0.6, 0.3], ambientIntensity: 0.3, directionalIntensity: 0.5, sunColor: [1.0, 0.7, 0.4] },
  { time: 0.5, topColor: [0.3, 0.55, 1.0], horizonColor: [0.6, 0.8, 1.0], ambientIntensity: 0.5, directionalIntensity: 1.0, sunColor: [1.0, 0.98, 0.9] },
  { time: 0.75, topColor: [0.15, 0.15, 0.4], horizonColor: [1.0, 0.4, 0.15], ambientIntensity: 0.25, directionalIntensity: 0.4, sunColor: [1.0, 0.5, 0.2] },
  { time: 1.0, topColor: [0.01, 0.01, 0.05], horizonColor: [0.02, 0.02, 0.08], ambientIntensity: 0.08, directionalIntensity: 0.02, sunColor: [0.1, 0.1, 0.2] },
] as const;

function lerpTuple(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function interpolateSky(time: number) {
  let from = SKY_KEYFRAMES[0];
  let to = SKY_KEYFRAMES[1];
  let t = 0;

  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (time >= SKY_KEYFRAMES[i].time && time <= SKY_KEYFRAMES[i + 1].time) {
      from = SKY_KEYFRAMES[i];
      to = SKY_KEYFRAMES[i + 1];
      const range = to.time - from.time;
      t = range > 0 ? (time - from.time) / range : 0;
      break;
    }
  }

  return {
    topColor: lerpTuple(from.topColor, to.topColor, t),
    horizonColor: lerpTuple(from.horizonColor, to.horizonColor, t),
    ambientIntensity: from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * t,
    directionalIntensity: from.directionalIntensity + (to.directionalIntensity - from.directionalIntensity) * t,
    sunColor: lerpTuple(from.sunColor, to.sunColor, t),
  };
}

function getSunPosition(time: number): THREE.Vector3 {
  const angle = time * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(
    Math.cos(angle) * 0.3,
    Math.sin(angle),
    Math.cos(angle) * 0.7,
  ).normalize();
}

const skyDomeVertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyDomeFragmentShader = `
  uniform vec3 topColor;
  uniform vec3 horizonColor;

  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition).y;
    float t = clamp(h * 2.0, 0.0, 1.0);
    vec3 color = mix(horizonColor, topColor, t);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function SkyboxSystem() {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const directionalRef = useRef<THREE.DirectionalLight>(null);
  const skyMatRef = useRef<THREE.ShaderMaterial>(null);
  const fogRef = useRef<THREE.Fog>(null);

  const timeOfDay = useWorldStore((s) => s.timeOfDay);
  const updateTime = useWorldStore((s) => s.updateTime);

  const skyGeometry = useMemo(() => {
    return new THREE.SphereGeometry(400, 32, 16);
  }, []);

  const skyMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: skyDomeVertexShader,
      fragmentShader: skyDomeFragmentShader,
      uniforms: {
        topColor: { value: new THREE.Vector3(0.3, 0.55, 1.0) },
        horizonColor: { value: new THREE.Vector3(0.6, 0.8, 1.0) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  useFrame((_, delta) => {
    updateTime(delta, DAY_DURATION);

    const sky = interpolateSky(timeOfDay);
    const sunPos = getSunPosition(timeOfDay);

    if (skyMatRef.current) {
      skyMatRef.current.uniforms.topColor.value.set(...sky.topColor);
      skyMatRef.current.uniforms.horizonColor.value.set(...sky.horizonColor);
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = sky.ambientIntensity;
      ambientRef.current.color.setRGB(...sky.topColor);
    }

    if (directionalRef.current) {
      directionalRef.current.intensity = sky.directionalIntensity;
      directionalRef.current.color.setRGB(...sky.sunColor);
      directionalRef.current.position.copy(sunPos.multiplyScalar(100));
    }

    if (fogRef.current) {
      const fogR = sky.horizonColor[0] * 0.7 + sky.topColor[0] * 0.3;
      const fogG = sky.horizonColor[1] * 0.7 + sky.topColor[1] * 0.3;
      const fogB = sky.horizonColor[2] * 0.7 + sky.topColor[2] * 0.3;
      fogRef.current.color.setRGB(fogR, fogG, fogB);
    }
  });

  return (
    <>
      <mesh geometry={skyGeometry} material={skyMaterial}>
        <primitive object={skyMaterial} ref={skyMatRef} attach="material" />
      </mesh>

      <ambientLight ref={ambientRef} intensity={0.4} />

      <directionalLight
        ref={directionalRef}
        position={[50, 80, 30]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={300}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      <fog ref={fogRef} attach="fog" args={["#99ccff", 50, 200]} />
    </>
  );
}
