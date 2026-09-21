"use client";

import { BarList, type BarItem } from "../../_components/motion/bar-list";
import { RingChart, type RingSegment } from "../../_components/motion/ring-chart";
import type { StatsSummary } from "../../_lib/contracts";
import { categoryColor, categoryLabel, engineSummary, engineTokens, fieldLabel, statusColor, statusLabel } from "../../_lib/labels";

function Panel({ title, note, index, children }: { title: string; note?: string; index: number; children: React.ReactNode }) {
  return (
    <section className="card animate-rise stagger p-6" style={{ "--i": index } as React.CSSProperties}>
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-bold">{title}</h3>
        {note && <span className="text-xs text-fg-faint">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** The four charts on the overview, all drawn from one stats response. */
export function StatsCharts({ stats }: { stats: StatsSummary }) {
  const statusSegments: RingSegment[] = ["OK", "MISMATCH", "NEEDS_REVIEW", "NOT_PROCESSED"].map((key) => ({
    key,
    label: statusLabel(key),
    value: stats.by_status[key] ?? 0,
    color: statusColor(key),
  }));

  const categoryBars: BarItem[] = Object.entries(stats.by_category)
    // "Not processed" is already the big grey slice of the ring; keeping it here would flatten every real category
    .filter(([key, count]) => count > 0 && key !== "NOT_PROCESSED")
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      label: categoryLabel(key),
      value: count,
      color: categoryColor(key),
      href: key === "NOT_PROCESSED" ? "/features/results?processing=pending" : `/features/results?category=${key}`,
    }));

  const fieldBars: BarItem[] = stats.defect_field_frequency.slice(0, 7).map((row) => ({
    key: row.field,
    label: fieldLabel(row.field),
    value: row.count,
    color: "var(--bad)",
    href: "/features/results/conflicts",
  }));

  // The saved tags list every pipeline stage ("rules/rules/rules/rules+jev"); group them by which engines took part
  const byEngine = new Map<string, { label: string; count: number; filter: string }>();
  for (const [raw, count] of Object.entries(stats.providers)) {
    const tokens = engineTokens(raw);
    const label = engineSummary(raw);
    const entry = byEngine.get(label) ?? { label, count: 0, filter: tokens[tokens.length - 1] ?? raw };
    entry.count += count;
    byEngine.set(label, entry);
  }
  const providerBars: BarItem[] = [...byEngine.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(({ label, count, filter }) => ({
      key: label,
      label,
      value: count,
      color: label.includes("Fallback") ? "var(--warn)" : label.includes("Jev") ? "var(--color-mint)" : "var(--accent)",
      href: `/features/results?provider=${encodeURIComponent(filter)}`,
    }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Outcome of every email" note="hover a slice" index={0}>
        <RingChart segments={statusSegments} centerLabel="emails" />
      </Panel>
      <Panel title="What people sent" note="by category" index={1}>
        <BarList items={categoryBars} />
      </Panel>
      <Panel title="Where SI and BL disagree most" note="mismatching fields" index={2}>
        <BarList items={fieldBars} empty="No mismatches found so far." />
      </Panel>
      <Panel title="Who answered" note="engine behind each result" index={3}>
        <BarList items={providerBars} empty="No results have been saved yet." />
      </Panel>
    </div>
  );
}
