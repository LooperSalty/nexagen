export const APP_NAME = "NEXAGEN" as const;

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4001";

export const WORLD_PROMPT_MAX_LENGTH = 500 as const;

export const GENERATION_POLL_INTERVAL_MS = 2000 as const;
