import { create } from "zustand";
import { ACTIVITIES, type Activity } from "../types";
import { inTauri, mediaCommand, saveSettings, setSystemMuted, setSystemVolume } from "../services/native";
import type { MediaInfo, PowerState, PrivacyState, Settings, ToastInfo, VolumeState } from "../types";

export type TimerKind = "focus" | "countdown" | "stopwatch";
export type PowerKind = "charging" | "full" | "unplugged";

const SETTINGS_KEY = "di-settings";
const defaults: Settings = {
  theme: "dark",
  accent: "#4cc9f0",
  glow: 0.5,
  animationSpeed: 1,
  reducedMotion:
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  monitor: 0,
  offsetX: 0,
  topMargin: 4,
  autoHideSeconds: 0,
  hideInFullscreen: true,
  shortcut: "Ctrl+Shift+D",
  notificationsEnabled: true,
  notificationPreviews: true,
  islandScale: 1,
  hoverMode: "hover",
  hoverDelay: 0,
  showMusic: true,
  showMicStatus: true,
  notificationSeconds: 7,
  showCharging: true,
  showVolume: true,
};

const SETTING_KEYS = Object.keys(defaults) as (keyof Settings)[];

function pickSettings(s: Settings): Settings {
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, s[k]])) as unknown as Settings;
}

function loadFallback(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export const currentSettings = () => pickSettings(useIslandStore.getState());

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Debounced so dragging a slider does not write to disk on every tick. */
function persist(s: Settings) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (inTauri) {
      void saveSettings(s);
    } else {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      } catch {
        /* storage unavailable */
      }
    }
  }, 150);
}

interface TimerState {
  kind: TimerKind;
  durationMs: number;
  running: boolean;
  startedAt: number;
  baseMs: number;
}

interface MediaState {
  available: boolean;
  title: string;
  artist: string;
  album: string;
  app: string;
  thumbnail: string | null;
  playing: boolean;
  baseSec: number;
  startedAt: number;
  durationSec: number;
}

interface IslandStore extends Settings {
  applyRemote: (s: Settings) => void;
  activity: Activity;
  hovered: boolean;
  full: boolean;
  timer: TimerState;
  media: MediaState;
  recStartedAt: number | null;
  hidden: boolean;
  privacy: PrivacyState;
  notification: ToastInfo | null;
  power: PowerState;
  powerEvent: PowerKind;
  volume: VolumeState | null;

  applyVolume: (v: VolumeState) => void;
  setVolumeLevel: (level: number) => void;
  toggleMute: () => void;

  applyPower: (p: PowerState) => void;
  applyPrivacy: (p: PrivacyState) => void;
  pushNotification: (n: ToastInfo) => void;
  dismissNotification: () => void;
  setHidden: (h: boolean) => void;
  setActivity: (a: Activity) => void;
  cycleActivity: (dir: 1 | -1) => void;
  setHovered: (h: boolean) => void;
  setFull: (f: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  toggleTheme: () => void;

  timerToggle: () => void;
  timerReset: () => void;
  timerSet: (kind: TimerKind, durationMs: number) => void;

  applyMedia: (info: MediaInfo | null) => void;
  mediaToggle: () => void;
  mediaSeek: (sec: number) => void;
  mediaSkip: (dir: "next" | "prev") => void;
  mediaVolume: (dir: "up" | "down") => void;
}

export const timerElapsed = (t: TimerState, now = Date.now()) =>
  t.baseMs + (t.running ? now - t.startedAt : 0);

export const mediaPosition = (m: MediaState, now = Date.now()) => {
  const pos = m.baseSec + (m.playing ? (now - m.startedAt) / 1000 : 0);
  return m.durationSec > 0 ? Math.min(m.durationSec, pos) : pos;
};

const VOLUME_VISIBLE_MS = 2000;
let volumeTimer: ReturnType<typeof setTimeout> | undefined;

/** Closes the volume view after a quiet 2 s, but never while the pointer is on the island. */
function scheduleVolumeHide() {
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(function check() {
    const s = useIslandStore.getState();
    if (s.activity !== "volume") return;
    if (s.hovered) {
      volumeTimer = setTimeout(check, 1000);
      return;
    }
    s.setActivity(restingActivity());
  }, VOLUME_VISIBLE_MS);
}

const POWER_VISIBLE_MS = 4000;
let powerTimer: ReturnType<typeof setTimeout> | undefined;

const restingActivity = (): Activity => (useIslandStore.getState().media.playing ? "music" : "idle");

let dismissTimer: ReturnType<typeof setTimeout> | undefined;

/** Closes a notification after a few seconds, but never while the pointer is on the island. */
function scheduleDismiss(id: number) {
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(function check() {
    const s = useIslandStore.getState();
    if (s.notification?.id !== id) return;
    if (s.hovered) {
      dismissTimer = setTimeout(check, 2000);
      return;
    }
    s.dismissNotification();
  }, useIslandStore.getState().notificationSeconds * 1000);
}

export const useIslandStore = create<IslandStore>((set, get) => ({
  ...loadFallback(),
  applyRemote: (s) => set(pickSettings({ ...defaults, ...s })),
  activity: "idle",
  hovered: false,
  full: false,
  recStartedAt: null,
  hidden: false,
  privacy: { mic: null, camera: null },
  notification: null,
  power: { percent: null, state: "none" },
  powerEvent: "charging",
  volume: null,
  setHidden: (hidden) => set({ hidden }),

  applyVolume: (next) => {
    const prev = get().volume;
    set({ volume: next });
    if (!prev || !get().showVolume) return;
    if (Math.abs(prev.level - next.level) < 0.005 && prev.muted === next.muted) return;
    const { activity, setActivity } = get();
    if (activity !== "mic" && activity !== "call") setActivity("volume");
    scheduleVolumeHide();
  },

  setVolumeLevel: (level) => {
    const l = Math.min(1, Math.max(0, level));
    set({ volume: { level: l, muted: false } });
    scheduleVolumeHide();
    void setSystemVolume(l);
  },

  toggleMute: () => {
    const cur = get().volume;
    if (!cur) return;
    set({ volume: { ...cur, muted: !cur.muted } });
    scheduleVolumeHide();
    void setSystemMuted(!cur.muted);
  },

  applyPower: (next) => {
    const prev = get().power;
    set({ power: next });
    if (!get().showCharging || prev.state === "none" || next.state === "none" || prev.state === next.state) return;
    let kind: PowerKind | null = null;
    if (next.state === "charging") kind = "charging";
    else if (next.state === "full") kind = "full";
    else if (next.state === "discharging") kind = "unplugged";
    if (!kind) return;
    const { activity, setActivity } = get();
    set({ powerEvent: kind });
    if (activity !== "mic" && activity !== "call") setActivity("charging");
    clearTimeout(powerTimer);
    powerTimer = setTimeout(() => {
      if (useIslandStore.getState().activity === "charging") useIslandStore.getState().setActivity(restingActivity());
    }, POWER_VISIBLE_MS);
  },

  applyPrivacy: (privacy) => {
    set({ privacy });
    const { activity, setActivity } = get();
    const inUse = Boolean(privacy.mic || privacy.camera);
    if (!get().showMicStatus) return;
    if (inUse && activity !== "mic") setActivity("mic");
    else if (!inUse && activity === "mic") setActivity(restingActivity());
  },

  pushNotification: (notification) => {
    set({ notification });
    const { activity, setActivity } = get();
    if (activity !== "mic" && activity !== "call") setActivity("notification");
    scheduleDismiss(notification.id);
  },

  dismissNotification: () => {
    clearTimeout(dismissTimer);
    const { activity, setActivity } = get();
    set({ notification: null });
    if (activity === "notification") setActivity(restingActivity());
  },
  timer: { kind: "focus", durationMs: 25 * 60_000, running: false, startedAt: 0, baseMs: 0 },
  media: {
    available: false,
    title: "",
    artist: "",
    album: "",
    app: "",
    thumbnail: null,
    playing: false,
    baseSec: 0,
    startedAt: 0,
    durationSec: 0,
  },

  setActivity: (activity) =>
    set({ activity, full: false, recStartedAt: activity === "recording" ? Date.now() : null }),

  cycleActivity: (dir) => {
    const i = ACTIVITIES.indexOf(get().activity);
    get().setActivity(ACTIVITIES[(i + dir + ACTIVITIES.length) % ACTIVITIES.length]);
  },

  setHovered: (hovered) => set(hovered ? { hovered } : { hovered, full: false }),
  setFull: (full) => set({ full }),

  updateSettings: (patch) => {
    set(patch);
    persist(pickSettings(get()));
  },
  toggleTheme: () => get().updateSettings({ theme: get().theme === "dark" ? "light" : "dark" }),

  timerToggle: () =>
    set(({ timer }) => {
      const now = Date.now();
      return timer.running
        ? { timer: { ...timer, running: false, baseMs: timerElapsed(timer, now) } }
        : { timer: { ...timer, running: true, startedAt: now } };
    }),
  timerReset: () => set(({ timer }) => ({ timer: { ...timer, running: false, baseMs: 0 } })),
  timerSet: (kind, durationMs) =>
    set({ timer: { kind, durationMs, running: false, startedAt: 0, baseMs: 0 } }),

  applyMedia: (info) => {
    const { activity, media, setActivity } = get();
    if (!info) {
      set({ media: { ...media, available: false, playing: false, title: "", artist: "", thumbnail: null } });
      if (activity === "music") setActivity("idle");
      return;
    }
    set({
      media: {
        ...media,
        available: true,
        title: info.title,
        artist: info.artist,
        album: info.album,
        app: info.app,
        thumbnail: info.thumbnail,
        playing: info.playing,
        baseSec: info.positionSec,
        startedAt: Date.now(),
        durationSec: info.durationSec,
      },
    });
    if (info.playing && activity === "idle" && get().showMusic) setActivity("music");
  },
  mediaToggle: () => {
    void mediaCommand("play_pause");
    set(({ media }) => {
      const now = Date.now();
      return {
        media: { ...media, playing: !media.playing, baseSec: mediaPosition(media, now), startedAt: now },
      };
    });
  },
  mediaSeek: (sec) => {
    void mediaCommand("seek", sec);
    set(({ media }) => ({ media: { ...media, baseSec: sec, startedAt: Date.now() } }));
  },
  mediaSkip: (dir) => {
    void mediaCommand(dir);
    set(({ media }) => ({ media: { ...media, baseSec: 0, startedAt: Date.now() } }));
  },
  mediaVolume: (dir) => {
    const current = get().volume?.level ?? 0.5;
    get().setVolumeLevel(current + (dir === "up" ? 0.05 : -0.05));
  },
}));
