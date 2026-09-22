"use client";

import { BarList, type BarItem } from "../../_components/motion/bar-list";
import { RingChart, type RingSegment } from "../../_components/motion/ring-chart";
import type { StatsSummary } from "../../_lib/contracts";
import { categoryColor, categoryLabel, fieldLabel, statusColor, statusLabel } from "../../_lib/labels";
import { Panel } from "./panel";

/** How every email came out: matches, mismatches, needs a person, not yet checked. */
export function OutcomePanel({ stats, index }: { stats: StatsSummary; index: number }) {
  const segments: RingSegment[] = ["OK", "MISMATCH", "NEEDS_REVIEW", "NOT_PROCESSED"].map((key) => ({
    key,
    label: statusLabel(key),
    value: stats.by_status[key] ?? 0,
    color: statusColor(key),
  }));
  return (
    <Panel title="Outcome of every email" note="hover a slice" index={index}>
      <RingChart segments={segments} centerLabel="emails" stacked size={164} />
    </Panel>
  );
}

/** The compared fields that disagree most often (top five). Each row opens the conflicts. */
export function MismatchPanel({ stats, index }: { stats: StatsSummary; index: number }) {
  const items: BarItem[] = stats.defect_field_frequency.slice(0, 5).map((row) => ({
    key: row.field,
    label: fieldLabel(row.field),
    value: row.count,
    color: "var(--bad)",
    href: "/features/results/conflicts",
  }));
  return (
    <Panel title="Most common mismatches" note="by field" index={index}>
      <BarList items={items} empty="No mismatches found so far." spread />
    </Panel>
  );
}

/** What kind of emails came in. */
export function CategoryPanel({ stats, index }: { stats: StatsSummary; index: number }) {
  const items: BarItem[] = Object.entries(stats.by_category)
    // "Not processed" is already the grey slice of the outcome ring; keeping it here would flatten every real category
    .filter(([key, count]) => count > 0 && key !== "NOT_PROCESSED")
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: categoryLabel(key),
      value: count,
      color: categoryColor(key),
      href: `/features/results?category=${key}`,
    }));
  return (
    <Panel title="What people sent" note="by category" index={index}>
      <BarList items={items} empty="Nothing has been classified yet." spread />
    </Panel>
  );
}
