"use client";

import { Canvas } from "@react-three/fiber";
import { Sky, PointerLockControls, Stats } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Suspense } from "react";

interface WorldCanvasProps {
  readonly worldId: string;
}

function LoadingPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#1A1A2E" />
    </mesh>
  );
}

function WorldEnvironment() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <Sky sunPosition={[50, 80, 30]} />
      <fog attach="fog" args={["#0A0A0F", 50, 200]} />
    </>
  );
}

export default function WorldCanvas({ worldId }: WorldCanvasProps) {
  return (
    <Canvas
      shadows
      camera={{ fov: 70, near: 0.1, far: 500, position: [0, 5, 10] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]}>
          <WorldEnvironment />
          <LoadingPlane />
        </Physics>
        <PointerLockControls />
      </Suspense>
      {process.env.NODE_ENV === "development" && <Stats />}
    </Canvas>
  );
}
