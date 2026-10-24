import { Phone, PhoneOff } from "lucide-react";
import { useIslandStore } from "../../stores/island";
import { Chip, IconButton, Panel, Row, Title } from "../ui";
import type { Mode } from "../../types";

export function CallView({ mode }: { mode: Mode }) {
  const end = () => useIslandStore.getState().setActivity("idle");
  return (
    <>
      <Row>
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-[12px] font-bold text-black">
          S
        </div>
        <Title title="Sarah" sub="Incoming Call" />
        <IconButton label="Decline" tone="danger" onClick={end}>
          <PhoneOff size={15} />
        </IconButton>
        <IconButton label="Accept" tone="success" onClick={end}>
          <Phone size={15} fill="currentColor" />
        </IconButton>
      </Row>
      {mode !== "compact" && (
        <Panel>
          <div className="text-[11px] text-[var(--fg2)]">Reply with a message</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip onClick={end}>Can't talk now</Chip>
            <Chip onClick={end}>Call you back</Chip>
            <Chip onClick={end}>On my way</Chip>
          </div>
        </Panel>
      )}
    </>
  );
}
