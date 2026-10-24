export type Activity =
  | "idle"
  | "music"
  | "call"
  | "notification"
  | "mic"
  | "system"
  | "charging"
  | "volume"
  | "transfer"
  | "timer"
  | "recording"
  | "nav"
  | "ai";

export type Mode = "idle" | "compact" | "expanded" | "full";

export const ACTIVITIES: Activity[] = [
  "idle",
  "music",
  "call",
  "notification",
  "mic",
  "system",
  "charging",
  "volume",
  "transfer",
  "timer",
  "recording",
  "nav",
  "ai",
];

/** Activities whose content is sample data until a native integration exists. */
export const PREVIEW_ACTIVITIES: Activity[] = [
  "call",
  "transfer",
  "recording",
  "nav",
  "ai",
];

export interface SystemInfo {
  cpu_usage: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_percent: number;
  battery_percent: number | null;
  battery_charging: boolean | null;
  uptime_secs: number;
}

export interface Settings {
  theme: "dark" | "light";
  accent: string;
  glow: number;
  animationSpeed: number;
  reducedMotion: boolean;
  monitor: number;
  offsetX: number;
  topMargin: number;
  autoHideSeconds: number;
  hideInFullscreen: boolean;
  shortcut: string;
  notificationsEnabled: boolean;
  notificationPreviews: boolean;
  islandScale: number;
  hoverMode: "hover" | "click";
  hoverDelay: number;
  showMusic: boolean;
  showMicStatus: boolean;
  notificationSeconds: number;
  showCharging: boolean;
  showVolume: boolean;
}

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
}

export interface MediaInfo {
  title: string;
  artist: string;
  album: string;
  app: string;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  thumbnail: string | null;
}

export interface PrivacyState {
  mic: string | null;
  camera: string | null;
}

export interface ToastInfo {
  id: number;
  app: string;
  title: string;
  body: string;
}

export interface PowerState {
  percent: number | null;
  state: "charging" | "full" | "discharging" | "none";
}

export interface VolumeState {
  level: number;
  muted: boolean;
}
