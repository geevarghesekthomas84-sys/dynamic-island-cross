import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Battery, BatteryCharging, Cpu, Plug } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { useSystemInfo } from "../../hooks/useSystemInfo";
import { useIslandStore } from "../../stores/island";
import { ROW } from "../../animations/sizes";
import type { Mode } from "../../types";

function formatUptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Soft blue / indigo / mint at rest; amber and red only when a value needs attention. */
function tone(pct: number, rest: string, invert = false) {
  const level = invert ? 100 - pct : pct;
  return level >= 90 ? "#f87171" : level >= 75 ? "#fbbf24" : rest;
}

function Stat({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium tabular-nums">
      <span className="text-[var(--fg2)]">{icon}</span>
      <span className="min-w-[2.6ch] text-right">{value}</span>
    </span>
  );
}

function Metric({ label, value, pct, color }: { label: string; value: string; pct?: number; color?: string }) {
  const reduced = useIslandStore((s) => s.reducedMotion);
  return (
    <div className="group -mx-2 grid h-5 grid-cols-[40px_1fr_78px] items-center gap-3 rounded-md px-2 transition-colors hover:bg-[var(--raised)]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--fg3)] transition-colors group-hover:text-[var(--fg2)]">
        {label}
      </span>
      {pct === undefined ? (
        <span />
      ) : (
        <div className="h-[3px] overflow-hidden rounded-full bg-[var(--raised)]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={false}
            animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}
      <span className="text-right text-[12px] font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function SystemView({ mode }: { mode: Mode }) {
  const info = useSystemInfo();
  const now = useNow(1000);
  const time = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const batt = info?.battery_percent ?? null;
  const charging = Boolean(info?.battery_charging);
  const BattIcon = batt === null ? Plug : charging ? BatteryCharging : Battery;

  return (
    <>
      <div className="flex items-center gap-3 px-4" style={{ height: ROW }}>
        <span className="text-[15px] font-semibold tabular-nums tracking-tight">{time}</span>
        <span className="h-3.5 w-px bg-[var(--line)]" />
        <div className="ml-auto flex items-center gap-4">
          <Stat icon={<Cpu size={14} strokeWidth={2} />} value={info ? `${Math.round(info.cpu_usage)}%` : "--"} />
          <Stat
            icon={<BattIcon size={14} strokeWidth={2} className={charging ? "text-emerald-300" : undefined} />}
            value={batt === null ? "AC" : `${Math.round(batt)}%`}
          />
        </div>
      </div>

      {mode !== "compact" && (
        <>
          <div className="mx-4 h-px bg-[var(--line)]" />
          <div className="flex flex-col px-4 pb-3 pt-2">
            <Metric
              label="CPU"
              value={info ? `${Math.round(info.cpu_usage)}%` : "--"}
              pct={info?.cpu_usage ?? 0}
              color={tone(info?.cpu_usage ?? 0, "var(--accent)")}
            />
            <Metric
              label="RAM"
              value={info ? `${info.memory_used_gb} / ${info.memory_total_gb} GB` : "--"}
              pct={info?.memory_percent ?? 0}
              color={tone(info?.memory_percent ?? 0, "#a5b4fc")}
            />
            {batt !== null && (
              <Metric
                label="Batt"
                value={`${Math.round(batt)}%${charging ? " ⚡" : ""}`}
                pct={batt}
                color={tone(batt, "#6ee7b7", true)}
              />
            )}
            {mode === "full" && info && <Metric label="Uptime" value={formatUptime(info.uptime_secs)} />}
          </div>
        </>
      )}
    </>
  );
}
