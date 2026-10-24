import { invoke } from "@tauri-apps/api/core";
import type { MediaInfo, MonitorInfo, PowerState, PrivacyState, VolumeState, Settings, SystemInfo } from "../types";

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!inTauri) return null;
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    console.warn(`[native] ${cmd} failed`, e);
    return null;
  }
}

export const setWindowSize = (width: number, height: number) =>
  call<void>("set_island_size", { width, height });

export const getSystemInfo = () => call<SystemInfo>("get_system_info");

export const getSettings = () => call<Settings>("get_settings");
export const saveSettings = (settings: Settings) => call<void>("save_settings", { settings });
export const listMonitors = async () => (await call<MonitorInfo[]>("list_monitors")) ?? [];
export const openSettings = () => call<void>("open_settings");

export const mediaCommand = (action: "play_pause" | "next" | "prev" | "seek", position?: number) =>
  call<void>("media_command", { action, position });
export const getMedia = () => call<MediaInfo>("get_media");

/** Like saveSettings but reports why it failed (e.g. a shortcut another app already owns). */
export async function trySaveSettings(settings: Settings): Promise<string | null> {
  if (!inTauri) return null;
  try {
    await invoke("save_settings", { settings });
    return null;
  } catch (e) {
    return String(e);
  }
}

export const getAutostart = async () => (await call<boolean>("get_autostart")) ?? false;
export const setAutostart = async (enabled: boolean) => (await call<boolean>("set_autostart", { enabled })) ?? false;

export const getPrivacy = () => call<PrivacyState>("get_privacy");
export const getNotificationAccess = async () => (await call<string>("get_notification_access")) ?? "unknown";

export const getPower = () => call<PowerState>("get_power");

export const getVolume = () => call<VolumeState>("get_volume");
export const setSystemVolume = (level: number) => call<boolean>("set_volume", { level });
export const setSystemMuted = (muted: boolean) => call<boolean>("set_muted", { muted });
