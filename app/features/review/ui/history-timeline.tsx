"use client";

import { Icon, type IconName } from "../../../_components/icon";
import { fullDate, relativeTime } from "../../../_lib/format";
import { ACTION_LABELS, type ReviewActionRow } from "./review-api";

const ACTION_ICON: Record<string, IconName> = {
  confirm: "checkCircle",
  correct: "edit",
  disposition: "target",
  defer: "pause",
  undefer: "play",
  note: "note",
  rerun: "refresh",
  undo: "undo",
};

/** Every action ever taken on this item, newest first, drawn as a vertical timeline that fills in from the top. */
export function HistoryTimeline({ actions, loading }: { actions: ReviewActionRow[]; loading: boolean }) {
  if (loading && actions.length === 0) return <p className="text-xs text-fg-faint">Loading history…</p>;
  if (actions.length === 0) return <p className="text-xs text-fg-faint">Nothing has been done to this item yet.</p>;

  const ordered = [...actions].sort((a, b) => b.id - a.id);
  return (
    <ol className="relative space-y-4 border-l border-line pl-6">
      {ordered.map((action, i) => (
        <li key={action.id} style={{ "--i": i } as React.CSSProperties} className="animate-rise stagger relative">
          <span className={`absolute -left-[2.05rem] flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-solid ${action.action_type === "undo" ? "text-warn" : "text-accent-strong"}`}>
            <Icon name={ACTION_ICON[action.action_type] ?? "info"} size={14} />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{ACTION_LABELS[action.action_type] ?? action.action_type}</span>
            <span className="text-xs text-fg-faint" title={fullDate(action.created_at)}>
              {relativeTime(action.created_at)} · {action.actor}
            </span>
          </div>
          {(action.note || action.reason) && <p className="mt-1 break-words rounded-xl bg-sunken px-3 py-2 text-xs text-fg-muted">{action.note ?? action.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
