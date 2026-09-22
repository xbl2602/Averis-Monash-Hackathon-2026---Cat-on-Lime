"use client";

import { Gauge } from "../../_components/motion/gauge";
import { CountUp } from "../../_components/motion/count-up";
import { Skeleton } from "../../_components/motion/skeleton";
import { Icon } from "../../_components/icon";
import type { StatsSummary } from "../../_lib/contracts";
import { percent, relativeTime } from "../../_lib/format";

/**
 * The one number the overview leads with: how much of the inbox has been checked. Shown as a ring beside
 * the headline. Without a database there is no such number, so it says what is missing instead.
 */
export function HeroCoverage({ stats, loading, databaseDown }: { stats: StatsSummary | null; loading: boolean; databaseDown: boolean }) {
  if (loading && !stats) {
    return (
      <div className="flex items-center gap-5">
        <Skeleton className="h-[132px] w-[132px] !rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex max-w-xs items-center gap-4 rounded-2xl border border-line bg-surface p-4 backdrop-blur-md">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn">
          <Icon name="database" size={24} />
        </span>
        <div className="text-sm">
          <div className="font-bold">{databaseDown ? "No database connected" : "Statistics unavailable"}</div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {databaseDown ? "Connect one in Settings to see live results." : "Try reloading the page."}
          </div>
        </div>
      </div>
    );
  }

  const done = percent(stats.processed, stats.total_emails);
  return (
    <div className="flex items-center gap-5">
      <Gauge value={done / 100} label="checked" color="var(--color-mint)" />
      <div>
        <div className="text-2xl font-extrabold">
          <CountUp value={stats.processed} /> <span className="text-base font-semibold text-fg-muted">of</span> <CountUp value={stats.total_emails} />
        </div>
        <div className="mt-0.5 text-sm text-fg-muted">emails checked</div>
        <div className="mt-2 text-xs text-fg-faint">Latest result {relativeTime(stats.last_updated_at)}</div>
      </div>
    </div>
  );
}
