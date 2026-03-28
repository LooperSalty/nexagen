"use client";

import { useCallback, useEffect } from "react";
import { usePlayerStore } from "../../stores/playerStore";
import { HOTBAR_SIZE } from "@nexagen/shared";

const SLOT_SIZE = 52;
const SLOT_GAP = 4;

export default function Hotbar() {
  const inventory = usePlayerStore((s) => s.inventory);
  const selectedSlot = usePlayerStore((s) => s.selectedSlot);
  const selectSlot = usePlayerStore((s) => s.selectSlot);

  const hotbarSlots = inventory.slots.slice(0, HOTBAR_SIZE);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        selectSlot(num - 1);
      }
    },
    [selectSlot],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: SLOT_GAP,
        padding: 6,
        borderRadius: 8,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        zIndex: 40,
        pointerEvents: "auto",
      }}
    >
      {hotbarSlots.map((stack, index) => {
        const isSelected = index === selectedSlot;
        return (
          <button
            key={index}
            onClick={() => selectSlot(index)}
            style={{
              position: "relative",
              width: SLOT_SIZE,
              height: SLOT_SIZE,
              borderRadius: 6,
              border: isSelected
                ? "2px solid #60a5fa"
                : "2px solid rgba(255, 255, 255, 0.15)",
              background: isSelected
                ? "rgba(96, 165, 250, 0.15)"
                : "rgba(255, 255, 255, 0.05)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              outline: "none",
              transition: "border-color 0.1s, background 0.1s",
            }}
            aria-label={`Hotbar slot ${index + 1}${stack ? `: ${stack.item.name}` : ""}`}
          >
            {stack && (
              <>
                <img
                  src={stack.item.icon}
                  alt={stack.item.name}
                  style={{
                    width: 36,
                    height: 36,
                    imageRendering: "pixelated",
                    objectFit: "contain",
                    pointerEvents: "none",
                  }}
                />
                {stack.quantity > 1 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 2,
                      right: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.9)",
                      lineHeight: 1,
                    }}
                  >
                    {stack.quantity}
                  </span>
                )}
              </>
            )}

            <span
              style={{
                position: "absolute",
                top: 2,
                left: 4,
                fontSize: 9,
                color: isSelected
                  ? "rgba(255, 255, 255, 0.8)"
                  : "rgba(255, 255, 255, 0.4)",
                lineHeight: 1,
                fontFamily: "monospace",
              }}
            >
              {index + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
