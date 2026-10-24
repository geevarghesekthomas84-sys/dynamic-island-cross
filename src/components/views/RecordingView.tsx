import { Pause, Square } from "lucide-react";
import { useIslandStore } from "../../stores/island";
import { useNow } from "../../hooks/useNow";
import { Chip, fmtTime, IconButton, Panel, Row, Title } from "../ui";
import type { Mode } from "../../types";

export function RecordingView({ mode }: { mode: Mode }) {
  const startedAt = useIslandStore((s) => s.recStartedAt) ?? Date.now();
  const now = useNow(500);
  const stop = () => useIslandStore.getState().setActivity("idle");
  return (
    <>
      <Row>
        <span className="pulse-dot grid size-6 shrink-0 place-items-center rounded-full border-2 border-[#ef4444]">
          <span className="size-2.5 rounded-full bg-[#ef4444]" />
        </span>
        <Title title="Recording…" sub={fmtTime((now - startedAt) / 1000)} />
        <IconButton label="Stop" size={30} onClick={stop}>
          <Square size={13} fill="currentColor" />
        </IconButton>
      </Row>
      {mode !== "compact" && (
        <Panel>
          <div className="text-[11px] text-[var(--fg2)]">Full screen · 1080p · 30 fps</div>
          <div className="flex gap-1.5">
            <Chip>
              <span className="inline-flex items-center gap-1">
                <Pause size={11} /> Pause
              </span>
            </Chip>
            <Chip onClick={stop}>Stop</Chip>
          </div>
        </Panel>
      )}
    </>
  );
}
