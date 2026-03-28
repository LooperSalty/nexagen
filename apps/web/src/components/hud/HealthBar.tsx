"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../../stores/playerStore";

const HEART_FULL = "\u2764\uFE0F";
const HEART_HALF = "\uD83D\uDC94";
const HEART_EMPTY = "\uD83E\uDD0D";
const HEARTS_PER_ROW = 10;

interface HeartProps {
  readonly type: "full" | "half" | "empty";
}

function Heart({ type }: HeartProps) {
  const symbol =
    type === "full" ? HEART_FULL : type === "half" ? HEART_HALF : HEART_EMPTY;

  return (
    <span
      style={{
        fontSize: 18,
        filter: type === "empty" ? "grayscale(1) opacity(0.4)" : "none",
        display: "inline-block",
        width: 20,
        textAlign: "center",
      }}
      aria-hidden="true"
    >
      {symbol}
    </span>
  );
}

function buildHearts(hp: number, maxHp: number): HeartProps["type"][] {
  const totalHearts = Math.ceil(maxHp / 2);
  const capped = Math.min(totalHearts, HEARTS_PER_ROW);
  const hearts: HeartProps["type"][] = [];

  for (let i = 0; i < capped; i++) {
    const heartHp = (i + 1) * 2;
    if (hp >= heartHp) {
      hearts.push("full");
    } else if (hp >= heartHp - 1) {
      hearts.push("half");
    } else {
      hearts.push("empty");
    }
  }

  return hearts;
}

export default function HealthBar() {
  const hp = usePlayerStore((s) => s.hp);
  const maxHp = usePlayerStore((s) => s.maxHp);
  const prevHpRef = useRef(hp);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (hp < prevHpRef.current) {
      setFlash(true);
      const timeout = setTimeout(() => setFlash(false), 300);
      prevHpRef.current = hp;
      return () => clearTimeout(timeout);
    }
    prevHpRef.current = hp;
  }, [hp]);

  const hearts = buildHearts(hp, maxHp);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 1,
        padding: "4px 8px",
        borderRadius: 6,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 40,
        pointerEvents: "none",
        animation: flash ? "healthFlash 0.3s ease-out" : "none",
      }}
      role="status"
      aria-label={`Health: ${hp} of ${maxHp}`}
    >
      {hearts.map((type, i) => (
        <Heart key={i} type={type} />
      ))}

      <style>{`
        @keyframes healthFlash {
          0% { background: rgba(239, 68, 68, 0.6); }
          100% { background: rgba(0, 0, 0, 0.45); }
        }
      `}</style>
    </div>
  );
}
