"use client";

const CROSSHAIR_SIZE = 20;
const CROSSHAIR_THICKNESS = 2;
const CROSSHAIR_GAP = 4;

const containerStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: CROSSHAIR_SIZE,
  height: CROSSHAIR_SIZE,
  pointerEvents: "none",
  zIndex: 50,
};

const horizontalStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: 0,
  right: 0,
  height: CROSSHAIR_THICKNESS,
  transform: "translateY(-50%)",
  background: "rgba(255, 255, 255, 0.85)",
  clipPath: `polygon(
    0% 0%,
    calc(50% - ${CROSSHAIR_GAP}px) 0%,
    calc(50% - ${CROSSHAIR_GAP}px) 100%,
    0% 100%,
    0% 0%,
    calc(50% + ${CROSSHAIR_GAP}px) 0%,
    100% 0%,
    100% 100%,
    calc(50% + ${CROSSHAIR_GAP}px) 100%,
    calc(50% + ${CROSSHAIR_GAP}px) 0%
  )`,
  mixBlendMode: "difference",
};

const verticalStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  top: 0,
  bottom: 0,
  width: CROSSHAIR_THICKNESS,
  transform: "translateX(-50%)",
  background: "rgba(255, 255, 255, 0.85)",
  clipPath: `polygon(
    0% 0%,
    100% 0%,
    100% calc(50% - ${CROSSHAIR_GAP}px),
    0% calc(50% - ${CROSSHAIR_GAP}px),
    0% 0%,
    0% calc(50% + ${CROSSHAIR_GAP}px),
    0% 100%,
    100% 100%,
    100% calc(50% + ${CROSSHAIR_GAP}px),
    0% calc(50% + ${CROSSHAIR_GAP}px)
  )`,
  mixBlendMode: "difference",
};

export default function Crosshair() {
  return (
    <div style={containerStyle} aria-hidden="true">
      <div style={horizontalStyle} />
      <div style={verticalStyle} />
    </div>
  );
}
