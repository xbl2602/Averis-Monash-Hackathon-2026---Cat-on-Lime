"use client";

import { CountUp } from "../../_components/motion/count-up";
import { Skeleton } from "../../_components/motion/skeleton";
import { DatabaseDown, LoadError } from "../../_components/results/states";
import type { StatsSummary } from "../../_lib/contracts";
import { percent, relativeTime } from "../../_lib/format";
import { useApi } from "../../_lib/use-api";
import { AttentionStrip } from "./attention-strip";
import { KpiTile } from "./kpi-tile";
import { StatsCharts } from "./stats-charts";

function StatsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading statistics">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-44 !rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72 !rounded-3xl" />
        <Skeleton className="h-72 !rounded-3xl" />
      </div>
    </div>
  );
}

/** Coverage bar: how much of the inbox has been through the pipeline. */
function CoverageBar({ stats }: { stats: StatsSummary }) {
  const done = percent(stats.processed, stats.total_emails);
  return (
    <div className="card glow-border animate-rise p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Coverage</div>
          <div className="mt-1 text-2xl font-extrabold sm:text-3xl">
            <CountUp value={stats.processed} /> <span className="text-fg-faint">of</span> <CountUp value={stats.total_emails} /> emails verified
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-extrabold text-gradient">
            <CountUp value={done} format={(n) => `${Math.round(n)}%`} />
          </div>
          <div className="text-xs text-fg-faint">Last result {relativeTime(stats.last_updated_at)}</div>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={100} aria-label="Emails verified">
        <div
          className="h-full origin-left rounded-full bg-gradient-to-r from-accent to-mint transition-[width] duration-1000 ease-out"
          style={{ width: `${done}%` }}
        />
      </div>
    </div>
  );
}

/** The live half of the overview: numbers and charts from /features/results/api/stats. */
export function LiveStats() {
  const { data, error, databaseDown, loading, reload } = useApi<StatsSummary>("/features/results/api/stats");

  if (loading && !data) return <StatsSkeleton />;
  if (databaseDown) return <DatabaseDown what="The live overview" />;
  if (error || !data) return <LoadError error={error ?? { message: "No statistics came back." }} onRetry={reload} />;

  const okCount = data.by_status.OK ?? 0;
  return (
    <div className="space-y-6">
      <CoverageBar stats={data} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile index={0} href="/features/results?status=OK" icon="checkCircle" color="var(--ok)" label="Matches" value={okCount} note={`${percent(okCount, data.total_emails)}% of all emails`} />
        <KpiTile index={1} href="/features/results/conflicts" icon="swap" color="var(--bad)" label="Mismatches" value={data.mismatch} note="SI and BL disagree" />
        <KpiTile index={2} href="/features/review" icon="flag" color="var(--warn)" label="Need review" value={data.needs_review} note="a person should look" />
        <KpiTile index={3} href="/features/results?processing=failed" icon="alert" color="var(--color-indigo)" label="Failed" value={data.failed} note="could not be processed" />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-bold">Needs your attention</h2>
        <AttentionStrip stats={data} />
      </div>

      <StatsCharts stats={data} />
    </div>
  );
}
