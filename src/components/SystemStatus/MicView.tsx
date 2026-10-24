import { Camera, Mic } from "lucide-react";
import { useIslandStore } from "../../stores/island";
import { Panel, Row, Title } from "../ui";
import type { Mode } from "../../types";

export function MicView({ mode }: { mode: Mode }) {
  const { mic, camera } = useIslandStore((s) => s.privacy);
  const active = Boolean(mic || camera);
  const what = mic && camera ? "Camera & microphone" : camera ? "Camera" : "Microphone";
  const who = mic ?? camera;
  const Icon = camera && !mic ? Camera : Mic;

  return (
    <>
      <Row>
        <Icon size={18} className={`shrink-0 ${active ? "text-emerald-400" : "text-[var(--fg2)]"}`} />
        <Title title={active ? what : "Mic & camera"} sub={active ? `In use · ${who}` : "Not in use"} />
        {active && <span className="pulse-dot size-2.5 shrink-0 rounded-full bg-[#ef4444]" />}
      </Row>
      {mode !== "compact" && (
        <Panel>
          <div className="space-y-1 text-[12px] text-[var(--fg2)]">
            <div>Microphone · {mic ?? "not in use"}</div>
            <div>Camera · {camera ?? "not in use"}</div>
          </div>
        </Panel>
      )}
    </>
  );
}
