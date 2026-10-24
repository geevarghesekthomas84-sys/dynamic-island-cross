import { CornerUpRight, MapPin } from "lucide-react";
import { Panel, Row } from "../ui";
import type { Mode } from "../../types";

const STEPS = [
  ["200 m", "Turn right onto Main St"],
  ["650 m", "Continue straight"],
  ["1.2 km", "Arrive at destination"],
];

export function NavView({ mode }: { mode: Mode }) {
  return (
    <>
      <Row>
        <MapPin size={20} className="shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[15px] font-semibold">200 m</div>
          <div className="text-[11px] text-sky-400">Turn right</div>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-500 text-white">
          <CornerUpRight size={17} />
        </span>
      </Row>
      {mode !== "compact" && (
        <Panel>
          {STEPS.slice(mode === "full" ? 0 : 1).map(([d, t]) => (
            <div key={d} className="flex items-center justify-between text-[12px]">
              <span className="text-[var(--fg2)]">{t}</span>
              <span className="font-semibold">{d}</span>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
