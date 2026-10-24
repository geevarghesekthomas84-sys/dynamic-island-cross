import { useEffect } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { timerElapsed, useIslandStore, type TimerKind } from "../../stores/island";
import { useNow } from "../../hooks/useNow";
import { Chip, fmtTime, IconButton, Panel, Progress, Row, Title } from "../ui";
import type { Mode } from "../../types";

const KINDS: { kind: TimerKind; label: string; ms: number }[] = [
  { kind: "focus", label: "Focus", ms: 25 * 60_000 },
  { kind: "countdown", label: "Timer", ms: 5 * 60_000 },
  { kind: "stopwatch", label: "Stopwatch", ms: 0 },
];
const PRESETS = [5, 15, 25, 45];

export function TimerView({ mode }: { mode: Mode }) {
  const timer = useIslandStore((s) => s.timer);
  const { timerToggle, timerReset, timerSet } = useIslandStore.getState();
  const now = useNow(200, timer.running);

  const elapsed = timerElapsed(timer, now);
  const counting = timer.kind !== "stopwatch";
  const remaining = Math.max(0, timer.durationMs - elapsed);
  const done = counting && remaining <= 0 && elapsed > 0;
  const shown = counting ? remaining : elapsed;
  const label = timer.kind === "focus" ? "Focus Timer" : timer.kind === "countdown" ? "Timer" : "Stopwatch";

  useEffect(() => {
    if (done && timer.running) timerToggle();
  }, [done, timer.running, timerToggle]);

  return (
    <>
      <Row>
        <Timer size={20} className={`shrink-0 ${timer.running ? "text-amber-400" : "text-[var(--fg2)]"}`} />
        <Title title={done ? "Done" : label} sub={fmtTime(shown / 1000)} />
        <IconButton label={timer.running ? "Pause" : "Start"} tone={timer.running ? "default" : "accent"} onClick={timerToggle}>
          {timer.running ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </IconButton>
        <IconButton label="Reset" tone="ghost" size={28} onClick={timerReset}>
          <RotateCcw size={14} />
        </IconButton>
      </Row>
      {mode !== "compact" && (
        <Panel>
          {counting && <Progress value={(elapsed / timer.durationMs) * 100} color="#f59e0b" height={5} />}
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <Chip key={k.kind} active={timer.kind === k.kind} onClick={() => timerSet(k.kind, k.ms)}>
                {k.label}
              </Chip>
            ))}
          </div>
          {mode === "full" && counting && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] text-[var(--fg2)]">Minutes</span>
              {PRESETS.map((m) => (
                <Chip
                  key={m}
                  active={timer.durationMs === m * 60_000}
                  onClick={() => timerSet(timer.kind, m * 60_000)}
                >
                  {m}
                </Chip>
              ))}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
