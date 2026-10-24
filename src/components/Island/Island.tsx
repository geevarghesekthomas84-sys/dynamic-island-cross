import { useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useIslandStore } from "../../stores/island";
import { computeMode, islandSize, PAD, resolveView, windowSize } from "../../animations/sizes";
import { contentTransition, contentVariants, islandSpring, magneticSpring } from "../../animations/springs";
import { useWindowSync } from "../../hooks/useWindowSync";
import { listen } from "@tauri-apps/api/event";
import { inTauri, openSettings } from "../../services/native";
import { PREVIEW_ACTIVITIES, type Activity, type Mode } from "../../types";
import { Indicator, type IndicatorState } from "../ui";
import { MusicView } from "../MediaPlayer/MusicView";
import { CallView } from "../Notifications/CallView";
import { NotificationView } from "../Notifications/NotificationView";
import { MicView } from "../SystemStatus/MicView";
import { SystemView } from "../SystemStatus/SystemView";
import { ChargingView } from "../SystemStatus/ChargingView";
import { VolumeView } from "../SystemStatus/VolumeView";
import { TransferView } from "../FileTransfer/TransferView";
import { TimerView } from "../Timer/TimerView";
import { RecordingView } from "../views/RecordingView";
import { NavView } from "../views/NavView";
import { AIView } from "../AIAssistant/AIView";

function IdleView() {
  const playing = useIslandStore((s) => s.media.available && s.media.playing);
  const busy = useIslandStore((s) => s.timer.running);
  const state: IndicatorState = playing ? "playing" : busy ? "busy" : "idle";
  return (
    <div className="grid h-9 place-items-center">
      <Indicator state={state} />
    </div>
  );
}

const VIEWS: Record<Activity, ComponentType<{ mode: Mode }>> = {
  idle: IdleView,
  music: MusicView,
  call: CallView,
  notification: NotificationView,
  mic: MicView,
  system: SystemView,
  charging: ChargingView,
  volume: VolumeView,
  transfer: TransferView,
  timer: TimerView,
  recording: RecordingView,
  nav: NavView,
  ai: AIView,
};

// Layout height is reported in zoomed or unzoomed units depending on the engine; detect once.
let offsetIsZoomed: boolean | undefined;
function visualHeight(el: HTMLElement, scale: number) {
  if (offsetIsZoomed === undefined) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;height:10px;zoom:2";
    document.body.appendChild(probe);
    offsetIsZoomed = probe.offsetHeight >= 19;
    probe.remove();
  }
  return el.offsetHeight * (offsetIsZoomed ? 1 : scale);
}

const MAX_HEIGHT = 560;

const RADIUS: Record<Mode, number> = { idle: 18, compact: 24, expanded: 28, full: 32 };
const LEAVE_DELAY_MS = 260;

export function Island() {
  const activity = useIslandStore((s) => s.activity);
  const hovered = useIslandStore((s) => s.hovered);
  const full = useIslandStore((s) => s.full);
  const reduced = useIslandStore((s) => s.reducedMotion);
  const speed = useIslandStore((s) => s.animationSpeed);
  const autoHide = useIslandStore((s) => s.autoHideSeconds);
  const hidden = useIslandStore((s) => s.hidden);
  const scale = useIslandStore((s) => s.islandScale);
  const hoverMode = useIslandStore((s) => s.hoverMode);
  const { setHovered, setFull, setHidden } = useIslandStore.getState();

  // In click mode, merely hovering never expands; an idle island opens its status view on click.
  const open = (hoverMode === "hover" && hovered) || (activity === "idle" && full);
  const view = resolveView(activity, open);
  const mode = computeMode(activity, open, full);
  const base = islandSize(view, mode);

  // Expanded panels are exactly as tall as their content, so there is never dead space.
  const contentRefs = useRef<Partial<Record<Activity, HTMLElement>>>({});
  const [measured, setMeasured] = useState<{ view: Activity; height: number } | null>(null);
  useEffect(() => {
    const el = contentRefs.current[view];
    if (!el) return;
    const update = () => setMeasured({ view, height: Math.ceil(visualHeight(el, scale)) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, mode, scale]);

  const fitted = (mode === "expanded" || mode === "full") && measured?.view === view;
  const height = fitted ? Math.min(MAX_HEIGHT, Math.max(measured.height, 48 * scale)) : base.height * scale;
  const size = { width: Math.round(base.width * scale), height: Math.round(height) };
  const win = windowSize(size);
  useWindowSync(win.width, win.height);

  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const enterTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(enterTimer.current), []);

  const enter = () => {
    clearTimeout(leaveTimer.current);
    const delay = useIslandStore.getState().hoverDelay;
    if (delay > 0) enterTimer.current = setTimeout(() => setHovered(true), delay);
    else setHovered(true);
  };
  const leave = () => {
    clearTimeout(enterTimer.current);
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHovered(false), LEAVE_DELAY_MS);
  };

  // In the desktop app the native watcher decides hover (the window ignores the mouse outside the island).
  useEffect(() => {
    if (!inTauri) return;
    const unlisten = listen<boolean>("island-hover", (e) => (e.payload ? enter() : leave()));
    return () => {
      void unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide: fade out after a quiet period; any activity or hover brings it back.
  useEffect(() => {
    if (autoHide <= 0 || activity !== "idle" || hovered) {
      setHidden(false);
      return;
    }
    const t = setTimeout(() => setHidden(true), autoHide * 1000);
    return () => clearTimeout(t);
  }, [autoHide, activity, hovered, setHidden]);

  const View = VIEWS[view];
  const spring = view === "charging" ? magneticSpring(reduced, speed) : islandSpring(reduced, speed);

  return (
    <div className="flex h-full w-full justify-center" style={{ paddingTop: PAD }}>
      <motion.div
        role="status"
        aria-live="polite"
        className="island relative overflow-hidden"
        initial={false}
        animate={{ width: size.width, height: size.height, borderRadius: Math.round(RADIUS[mode] * scale), opacity: hidden ? 0 : 1, y: hidden ? -6 : 0 }}
        transition={spring}
        onMouseEnter={inTauri ? undefined : enter}
        onMouseLeave={inTauri ? undefined : leave}
        onClick={() => (hoverMode === "click" || activity !== "idle" || hovered ? setFull(!full) : undefined)}
        onContextMenu={(e) => {
          e.preventDefault();
          void openSettings();
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={view}
            style={{ width: size.width }}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={contentTransition(reduced)}
          >
            <div
              style={{ zoom: scale }}
              ref={(el: HTMLDivElement | null) => {
                if (el) contentRefs.current[view] = el;
              }}
            >
              <View mode={mode} />
            </div>
          </motion.div>
        </AnimatePresence>

        {mode === "full" && PREVIEW_ACTIVITIES.includes(view) && (
          <div className="pointer-events-none absolute bottom-1.5 right-3.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--fg3)]">
            Preview data
          </div>
        )}
      </motion.div>
    </div>
  );
}
