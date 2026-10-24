import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { motion } from "motion/react";
import { useIslandStore } from "../stores/island";

type Tone = "default" | "danger" | "success" | "accent" | "ghost";

const TONES: Record<Tone, string> = {
  default: "bg-[var(--raised)] hover:bg-[var(--raised-hi)] text-[var(--fg)]",
  ghost: "bg-transparent hover:bg-[var(--raised)] text-[var(--fg2)]",
  danger: "bg-[#ef4444] hover:bg-[#f25a5a] text-white",
  success: "bg-[#22c55e] hover:bg-[#3ad06f] text-white",
  accent: "bg-[var(--accent)] hover:brightness-110 text-black",
};

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  tone?: Tone;
  size?: number;
}

export function IconButton({ children, onClick, label, tone = "default", size = 32 }: IconButtonProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      onClick={(e) => {
        stop(e);
        onClick?.();
      }}
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-full transition-colors ${TONES[tone]}`}
    >
      {children}
    </motion.button>
  );
}

export function Chip({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-[var(--accent)] text-black"
          : "bg-[var(--raised)] text-[var(--fg2)] hover:bg-[var(--raised-hi)] hover:text-[var(--fg)]"
      }`}
    >
      {children}
    </button>
  );
}

export function Progress({
  value,
  color = "var(--accent)",
  height = 4,
  onSeek,
}: {
  value: number;
  color?: string;
  height?: number;
  onSeek?: (ratio: number) => void;
}) {
  const reduced = useIslandStore((s) => s.reducedMotion);
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-[var(--raised)] ${onSeek ? "cursor-pointer" : ""}`}
      style={{ height }}
      onClick={(e) => {
        if (!onSeek) return;
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
      }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 30 }}
      />
    </div>
  );
}

const WAVE_DELAYS = [0, 0.15, 0.3, 0.08, 0.22, 0.38, 0.12, 0.27, 0.05];

export function Waveform({
  active = true,
  color = "var(--accent)",
  bars = 7,
  height = 20,
}: {
  active?: boolean;
  color?: string;
  bars?: number;
  height?: number;
}) {
  return (
    <div className="wave flex items-center gap-[3px]" data-paused={!active} style={{ height, color }}>
      {Array.from({ length: bars }, (_, i) => (
        <i
          key={i}
          style={{
            animationDelay: `${WAVE_DELAYS[i % WAVE_DELAYS.length]}s`,
            animationDuration: `${0.6 + (i % 4) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

export type IndicatorState = "idle" | "playing" | "busy";

// Per-bar resting height and playing range (scaleY), tempo and phase. Symmetric so it reads as calm.
const INDICATOR_BARS = [
  { h: 0.3, lo: 0.18, hi: 0.62, d: 0.95, delay: 0 },
  { h: 0.58, lo: 0.25, hi: 0.9, d: 0.78, delay: 0.12 },
  { h: 1, lo: 0.3, hi: 1, d: 0.66, delay: 0.05 },
  { h: 0.58, lo: 0.25, hi: 0.85, d: 0.82, delay: 0.2 },
  { h: 0.3, lo: 0.18, hi: 0.6, d: 0.98, delay: 0.1 },
];

/** Center mark of the idle pill: still when idle, a gentle waveform when playing, a soft sweep when busy. */
export function Indicator({ state }: { state: IndicatorState }) {
  return (
    <div className="ind" data-state={state} aria-hidden>
      {INDICATOR_BARS.map((bar, i) => (
        <i
          key={i}
          style={
            {
              "--h": bar.h,
              "--lo": bar.lo,
              "--hi": bar.hi,
              "--d": `${bar.d}s`,
              "--delay": `${state === "busy" ? i * 0.14 : bar.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-3 px-3.5" style={{ height: 48 }}>
    {children}
  </div>
);

export const Title = ({ title, sub }: { title: string; sub: string }) => (
  <div className="min-w-0 flex-1 leading-tight">
    <div className="truncate text-[13px] font-semibold">{title}</div>
    <div className="truncate text-[11px] text-[var(--fg2)]">{sub}</div>
  </div>
);

export const Panel = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2.5 px-4 pb-3.5 pt-1">{children}</div>
);

export function fmtTime(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
