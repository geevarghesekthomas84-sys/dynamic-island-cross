import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Island } from "./components/Island/Island";
import { SettingsWindow } from "./components/Settings/SettingsWindow";
import { getMedia, getPower, getPrivacy, getSettings, getVolume, inTauri } from "./services/native";
import { useIslandStore } from "./stores/island";
import type { MediaInfo, PowerState, PrivacyState, Settings, ToastInfo, VolumeState } from "./types";

const isSettingsView = new URLSearchParams(window.location.search).get("view") === "settings";

export default function App() {
  const theme = useIslandStore((s) => s.theme);
  const accent = useIslandStore((s) => s.accent);
  const glow = useIslandStore((s) => s.glow);
  const reduced = useIslandStore((s) => s.reducedMotion);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.reduced = String(reduced);
    root.dataset.view = isSettingsView ? "settings" : "island";
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--glow", String(glow));
  }, [theme, accent, glow, reduced]);

  // Load saved settings, then follow changes made from the other window.
  useEffect(() => {
    if (!inTauri) return;
    const { applyRemote } = useIslandStore.getState();
    void getSettings().then((s) => s && applyRemote(s));
    const unlisten = listen<Settings>("settings-changed", (e) => applyRemote(e.payload));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  // Microphone / camera activity and system notifications (island window only).
  useEffect(() => {
    if (!inTauri || isSettingsView) return;
    const { applyPrivacy, pushNotification, applyPower, applyVolume } = useIslandStore.getState();
    void getPrivacy().then((p) => p && applyPrivacy(p));
    void getPower().then((p) => p && applyPower(p));
    void getVolume().then((v) => v && applyVolume(v));
    const offs = [
      listen<PrivacyState>("privacy-changed", (e) => applyPrivacy(e.payload)),
      listen<PowerState>("power-changed", (e) => applyPower(e.payload)),
      listen<VolumeState>("volume-changed", (e) => applyVolume(e.payload)),
      listen<ToastInfo>("notification-received", (e) => pushNotification(e.payload)),
    ];
    return () => {
      offs.forEach((u) => void u.then((fn) => fn()));
    };
  }, []);

  // System media session (island window only).
  useEffect(() => {
    if (!inTauri || isSettingsView) return;
    const { applyMedia } = useIslandStore.getState();
    void getMedia().then((m) => m && applyMedia(m));
    const unlisten = listen<MediaInfo | null>("media-changed", (e) => applyMedia(e.payload));
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (isSettingsView) return;
    const onKey = (e: KeyboardEvent) => {
      const s = useIslandStore.getState();
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") s.cycleActivity(1);
      else if (e.key === "ArrowLeft") s.cycleActivity(-1);
      else if (e.key === "Escape") s.setFull(false);
      else if (e.key === "Enter" || e.key === " ") s.setFull(!s.full);
      else if (e.key.toLowerCase() === "t") s.toggleTheme();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return isSettingsView ? <SettingsWindow /> : <Island />;
}
