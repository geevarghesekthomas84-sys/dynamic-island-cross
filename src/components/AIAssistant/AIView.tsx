import { useState } from "react";
import { Send } from "lucide-react";
import { Chip, IconButton, Panel, Row, Waveform } from "../ui";
import type { Mode } from "../../types";

export function AIView({ mode }: { mode: Mode }) {
  const [text, setText] = useState("");
  return (
    <>
      <Row>
        <div
          className="size-7 shrink-0 rounded-full"
          style={{ background: "conic-gradient(from 200deg,#818cf8,#c084fc,#38bdf8,#818cf8)" }}
        />
        <div className="flex-1 text-[13px] font-semibold">Listening…</div>
        <div className="text-violet-400">
          <Waveform bars={9} height={22} color="#a78bfa" />
        </div>
      </Row>
      {mode !== "compact" && (
        <Panel>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setText("");
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask anything…"
              className="h-8 min-w-0 flex-1 rounded-full bg-[var(--raised)] px-3.5 text-[12px] text-[var(--fg)] outline-none placeholder:text-[var(--fg3)] focus:ring-1 focus:ring-[var(--accent)]"
            />
            <IconButton label="Send" tone="accent" size={32}>
              <Send size={14} />
            </IconButton>
          </form>
          {mode === "full" && (
            <div className="flex flex-wrap gap-1.5">
              <Chip onClick={() => setText("Summarize my clipboard")}>Summarize clipboard</Chip>
              <Chip onClick={() => setText("What's on my calendar?")}>Calendar</Chip>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
