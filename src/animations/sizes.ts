import type { Activity, Mode } from "../types";

/** Transparent margin around the island so its glow and shadow are not clipped by the window. */
export const PAD = 14;
export const ROW = 48;

const COMPACT_WIDTH: Record<Activity, number> = {
  idle: 132,
  music: 380,
  call: 340,
  notification: 340,
  mic: 240,
  system: 320,
  charging: 300,
  volume: 300,
  transfer: 360,
  timer: 290,
  recording: 270,
  nav: 290,
  ai: 340,
};

const PANEL_WIDTH: Partial<Record<Activity, number>> = { system: 344, charging: 300 };
const DEFAULT_PANEL_WIDTH = 420;
const EXPANDED_PANEL = 72;
const FULL_PANEL = 184;

export function computeMode(activity: Activity, hovered: boolean, full: boolean): Mode {
  if (activity === "charging") return "expanded";
  if (activity === "volume") return "compact";
  const peek = activity === "idle" && hovered;
  if (full && (peek || activity !== "idle")) return "full";
  if (peek) return "expanded";
  if (activity === "idle") return "idle";
  return hovered ? "expanded" : "compact";
}

/** Idle + hover "peeks" at the system status. */
export function resolveView(activity: Activity, hovered: boolean): Activity {
  return activity === "idle" && hovered ? "system" : activity;
}

export function islandSize(view: Activity, mode: Mode): { width: number; height: number } {
  switch (mode) {
    case "idle":
      return { width: COMPACT_WIDTH.idle, height: 36 };
    case "compact":
      return { width: COMPACT_WIDTH[view], height: ROW };
    case "expanded":
      return { width: PANEL_WIDTH[view] ?? DEFAULT_PANEL_WIDTH, height: ROW + EXPANDED_PANEL };
    case "full":
      return { width: PANEL_WIDTH[view] ?? DEFAULT_PANEL_WIDTH, height: ROW + FULL_PANEL };
  }
}

export function windowSize(island: { width: number; height: number }) {
  return { width: island.width + PAD * 2, height: island.height + PAD * 2 };
}
