"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { usePlayerStore } from "../../stores/playerStore";
import { useWorldStore } from "../../stores/worldStore";
import { CHUNK_SIZE } from "@nexagen/shared";
import { BIOME_CONFIG } from "@nexagen/shared";
import type { BiomeType } from "@nexagen/shared";

function getMemoryUsage(): string {
  if (typeof performance !== "undefined" && "memory" in performance) {
    const mem = (performance as { memory: { usedJSHeapSize: number } }).memory;
    const mb = (mem.usedJSHeapSize / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  }
  return "N/A";
}

function getBiomeName(cx: number, cz: number): string {
  const hash = ((cx * 73856093) ^ (cz * 19349663)) >>> 0;
  const biomeIndex = hash % 10;
  const config = BIOME_CONFIG[biomeIndex as BiomeType];
  return config?.name ?? "Unknown";
}

export default function DebugOverlay() {
  const fps = useGameStore((s) => s.fps);
  const debugMode = useGameStore((s) => s.debugMode);
  const toggleDebug = useGameStore((s) => s.toggleDebug);
  const position = usePlayerStore((s) => s.position);
  const loadedChunks = useWorldStore((s) => s.loadedChunks);
  const timeOfDay = useWorldStore((s) => s.timeOfDay);
  const [memory, setMemory] = useState("N/A");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        toggleDebug();
      }
    },
    [toggleDebug],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!debugMode) return;
    const interval = setInterval(() => {
      setMemory(getMemoryUsage());
    }, 1000);
    return () => clearInterval(interval);
  }, [debugMode]);

  if (!debugMode) {
    return null;
  }

  const cx = Math.floor(position.x / CHUNK_SIZE);
  const cz = Math.floor(position.z / CHUNK_SIZE);
  const biomeName = getBiomeName(cx, cz);
  const timeHours = Math.floor(timeOfDay * 24);
  const timeMinutes = Math.floor((timeOfDay * 24 * 60) % 60);

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        padding: "8px 12px",
        borderRadius: 6,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        color: "#e2e8f0",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 12,
        lineHeight: 1.6,
        zIndex: 60,
        pointerEvents: "none",
        minWidth: 220,
      }}
      aria-label="Debug overlay"
    >
      <div style={{ color: fpsColor(fps), fontWeight: 700 }}>
        FPS: {fps}
      </div>
      <div>
        Pos: {position.x.toFixed(1)}, {position.y.toFixed(1)},{" "}
        {position.z.toFixed(1)}
      </div>
      <div>
        Chunk: {cx}, {cz}
      </div>
      <div>Biome: {biomeName}</div>
      <div>Loaded chunks: {loadedChunks}</div>
      <div>Memory: {memory}</div>
      <div>
        Time: {String(timeHours).padStart(2, "0")}:
        {String(timeMinutes).padStart(2, "0")}
      </div>
    </div>
  );
}

function fpsColor(fps: number): string {
  if (fps >= 55) return "#4ade80";
  if (fps >= 30) return "#facc15";
  return "#f87171";
}
