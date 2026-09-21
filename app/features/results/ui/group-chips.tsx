"use client";

import { categoryColor, categoryLabel, statusColor, statusLabel } from "../../../_lib/labels";
import type { GroupField } from "./filters";

/** When the list is grouped, one animated chip per group with its size; clicking a chip narrows the list to it. */
export function GroupChips({ groupBy, groups, onPick }: { groupBy: GroupField; groups: { key: string; count: number }[]; onPick: (key: string) => void }) {
  if (!groupBy || groups.length === 0) return null;
  const label = groupBy === "category" ? categoryLabel : statusLabel;
  const color = groupBy === "category" ? categoryColor : statusColor;

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group, i) => (
        <button
          key={group.key}
          type="button"
          onClick={() => onPick(group.key)}
          style={{ "--i": i } as React.CSSProperties}
          className="animate-pop stagger card card-hover flex items-center gap-3 !rounded-full px-4 py-2 text-sm"
        >
          <span className="h-3 w-3 rounded-full" style={{ background: color(group.key) }} />
          <span className="font-semibold">{label(group.key)}</span>
          <span className="rounded-full bg-sunken px-2 py-0.5 font-mono text-xs tabular-nums text-fg-muted">{group.count.toLocaleString("en-US")}</span>
        </button>
      ))}
    </div>
  );
}
