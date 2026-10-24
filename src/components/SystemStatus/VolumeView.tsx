import type { PointerEvent } from "react";
import { motion } from "motion/react";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { useIslandStore } from "../../stores/island";
import { IconButton } from "../ui";

function iconFor(pct: number, muted: boolean) {
  if (muted || pct === 0) return VolumeX;
  if (pct < 34) return Volume;
  if (pct < 67) return Volume1;
  return Volume2;
}

export function VolumeView() {
  const volume = useIslandStore((s) => s.volume);
  const reduced = useIslandStore((s) => s.reducedMotion);
  const { setVolumeLevel, toggleMute } = useIslandStore.getState();

  const level = volume?.level ?? 0;
  const muted = volume?.muted ?? false;
  const pct = Math.round(level * 100);
  const Icon = iconFor(pct, muted);

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setVolumeLevel(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="flex items-center gap-3 px-4" style={{ height: 48 }}>
      <IconButton label={muted ? "Unmute" : "Mute"} tone="ghost" size={28} onClick={toggleMute}>
        <motion.span
          key={muted || pct === 0 ? "off" : pct < 34 ? "low" : pct < 67 ? "mid" : "high"}
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className="grid place-items-center"
        >
          <Icon size={17} strokeWidth={2.2} />
        </motion.span>
      </IconButton>

      <div
        className="flex h-7 flex-1 cursor-pointer items-center"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) fromPointer(e);
        }}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--raised)]">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: muted
                ? "var(--fg3)"
                : "linear-gradient(90deg, var(--fg), color-mix(in srgb, var(--fg) 30%, var(--accent)))",
            }}
            initial={false}
            animate={{ width: `${muted ? 0 : pct}%` }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42 }}
          />
        </div>
      </div>

      <span className="w-11 text-right text-[13px] font-semibold tabular-nums">{muted ? "Muted" : `${pct}%`}</span>
    </div>
  );
}
