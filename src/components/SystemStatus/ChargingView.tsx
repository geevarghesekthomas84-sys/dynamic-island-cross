import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { BatteryFull, Unplug, Zap } from "lucide-react";
import { useIslandStore } from "../../stores/island";
import type { PowerKind } from "../../stores/island";

const EMERALD = "#34d399";

function Percent({ value }: { value: number }) {
  const reduced = useIslandStore((s) => s.reducedMotion);
  const mv = useMotionValue(reduced ? value : 0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [mv, value, reduced]);
  return <motion.span>{rounded}</motion.span>;
}

const COPY: Record<PowerKind, string> = {
  charging: "Charging",
  full: "Fully charged",
  unplugged: "Unplugged",
};

export function ChargingView() {
  const reduced = useIslandStore((s) => s.reducedMotion);
  const percent = useIslandStore((s) => s.power.percent);
  const kind = useIslandStore((s) => s.powerEvent);
  const charging = kind === "charging";
  const value = percent ?? 0;
  const accent = kind === "unplugged" ? "var(--fg2)" : EMERALD;
  const Icon = kind === "full" ? BatteryFull : kind === "unplugged" ? Unplug : Zap;

  return (
    <div className="px-4">
      <div className="flex items-center gap-3" style={{ height: 48 }}>
        <div className="relative grid size-7 shrink-0 place-items-center">
          {charging && !reduced && <span className="charge-pulse absolute inset-0 rounded-full" />}
          <motion.span
            key={kind}
            initial={reduced ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="relative grid size-7 place-items-center rounded-full"
            style={{
              background: `color-mix(in srgb, ${accent} 16%, transparent)`,
              color: accent,
              boxShadow: charging ? `0 0 10px color-mix(in srgb, ${EMERALD} 28%, transparent)` : "none",
            }}
          >
            <Icon size={15} strokeWidth={2.4} fill={charging ? "currentColor" : "none"} />
          </motion.span>
        </div>

        <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px] font-semibold tabular-nums">
          <span>{COPY[kind]}</span>
          {kind !== "full" && (
            <>
              <span className="text-[var(--fg3)]">—</span>
              <span>
                <Percent value={value} />%
              </span>
            </>
          )}
        </div>
      </div>

      <div className="pb-3.5">
        <div className="h-1 overflow-hidden rounded-full bg-[var(--raised)]">
          <motion.div
            className={`relative h-full rounded-full ${charging ? "charge-flow" : ""}`}
            style={{ background: kind === "unplugged" ? "var(--fg2)" : `linear-gradient(90deg, #10b981, ${EMERALD})` }}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 20 }}
          />
        </div>
      </div>
    </div>
  );
}
