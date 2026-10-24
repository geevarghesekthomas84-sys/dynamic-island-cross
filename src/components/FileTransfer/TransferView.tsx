import { FileText, X } from "lucide-react";
import { useIslandStore } from "../../stores/island";
import { Chip, IconButton, Panel, Progress, Row } from "../ui";
import type { Mode } from "../../types";

export function TransferView({ mode }: { mode: Mode }) {
  const close = () => useIslandStore.getState().setActivity("idle");
  return (
    <>
      <Row>
        <FileText size={20} className="shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold">Downloading…</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-[var(--fg2)]">1.2 GB / 3.8 GB</span>
            <Progress value={32} />
          </div>
        </div>
        <IconButton label="Cancel" size={28} onClick={close}>
          <X size={15} />
        </IconButton>
      </Row>
      {mode !== "compact" && (
        <Panel>
          <div className="flex justify-between text-[11px] text-[var(--fg2)]">
            <span>18.4 MB/s</span>
            <span>~2 min left</span>
          </div>
          <div className="flex gap-1.5">
            <Chip>Pause</Chip>
            <Chip onClick={close}>Cancel</Chip>
          </div>
        </Panel>
      )}
    </>
  );
}
