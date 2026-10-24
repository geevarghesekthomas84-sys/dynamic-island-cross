import { Bell } from "lucide-react";
import { useIslandStore } from "../../stores/island";
import { Chip, Panel, Row, Title } from "../ui";
import type { Mode } from "../../types";

export function NotificationView({ mode }: { mode: Mode }) {
  const n = useIslandStore((s) => s.notification);
  const dismiss = useIslandStore((s) => s.dismissNotification);

  if (!n) {
    return (
      <Row>
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--raised)] text-[var(--fg2)]">
          <Bell size={16} />
        </div>
        <Title title="No new notifications" sub="You're all caught up" />
      </Row>
    );
  }

  const hasText = n.title || n.body;
  return (
    <>
      <Row>
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-[13px] font-bold text-black">
          {n.app.charAt(0).toUpperCase()}
        </div>
        <Title title={hasText ? n.title || n.app : n.app} sub={hasText ? n.app : "New notification"} />
        <span className="size-2 shrink-0 rounded-full bg-[var(--accent)]" />
      </Row>
      {mode !== "compact" && (
        <Panel>
          {n.body && (
            <div className="line-clamp-3 whitespace-pre-line text-[12px] leading-snug text-[var(--fg2)]">{n.body}</div>
          )}
          <div className="flex gap-1.5">
            <Chip onClick={dismiss}>Dismiss</Chip>
          </div>
        </Panel>
      )}
    </>
  );
}
