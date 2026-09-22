"use client";

import Link from "next/link";
import { Icon } from "../../_components/icon";
import { HeroBanner } from "../../_components/motion/hero-banner";
import { Skeleton } from "../../_components/motion/skeleton";
import { DatabaseDown, LoadError } from "../../_components/results/states";
import type { StatsSummary } from "../../_lib/contracts";
import { percent } from "../../_lib/format";
import { useApi } from "../../_lib/use-api";
import { AccuracyStats } from "../../_components/accuracy-stats";
import { AttentionList } from "./attention-strip";
import { HeroCoverage } from "./hero-coverage";
import { KpiTile } from "./kpi-tile";
import { Panel } from "./panel";
import { QuickActions } from "./quick-actions";
import { CategoryPanel, MismatchPanel, OutcomePanel } from "./stats-charts";

function OverviewSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading the overview">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40 !rounded-3xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-72 !rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * The overview: one headline number (how much is checked), four outcome counts, then what needs attention,
 * how it all came out, and where to go next. Three tidy rows that fill the width; no module wall, nothing
 * about how the engine works.
 */
export function DashboardHome() {
  const { data: stats, error, databaseDown, loading, reload } = useApi<StatsSummary>("/features/results/api/stats");

  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow="Overview"
        title="Your shipping paperwork,"
        highlight="checked and clear."
        description="Every email sorted, every SI and BL compared, every doubt handed to a person. Start a verification, or pick up where the last one left off."
        actions={
          <>
            <Link href="/features/verification" className="btn btn-primary btn-shine !px-6 !py-3">
              <Icon name="play" size={16} />
              Run verification
            </Link>
            <Link href="/features/review" className="btn btn-glass !px-6 !py-3">
              <Icon name="flag" size={16} />
              Open review queue
            </Link>
          </>
        }
        aside={<HeroCoverage stats={stats} loading={loading} databaseDown={databaseDown} />}
      />

      {loading && !stats ? (
        <OverviewSkeleton />
      ) : databaseDown ? (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <DatabaseDown what="The live overview" />
          <QuickActions index={1} />
        </div>
      ) : error || !stats ? (
        <LoadError error={error ?? { message: "No statistics came back." }} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiTile index={0} href="/features/results?status=OK" icon="checkCircle" color="var(--ok)" label="Matches" value={stats.by_status.OK ?? 0} note={`${percent(stats.by_status.OK ?? 0, stats.total_emails)}% of all emails`} />
            <KpiTile index={1} href="/features/results/conflicts" icon="swap" color="var(--bad)" label="Mismatches" value={stats.mismatch} note="SI and BL disagree" />
            <KpiTile index={2} href="/features/review" icon="flag" color="var(--warn)" label="Need review" value={stats.needs_review} note="a person should look" />
            <KpiTile index={3} href="/features/results?processing=failed" icon="alert" color="var(--color-indigo)" label="Failed" value={stats.failed} note="could not be processed" />
          </div>

          {/* What to do next: the things waiting for a person, and the shortcuts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
            <AttentionList stats={stats} index={0} />
            <QuickActions index={1} />
          </div>

          {/* How it all came out */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <OutcomePanel stats={stats} index={2} />
            <MismatchPanel stats={stats} index={3} />
            <CategoryPanel stats={stats} index={4} />
          </div>
        </>
      )}

      <Panel title="How accurate is it?" note="measured, not estimated" index={5}>
        <AccuracyStats variant="app" />
      </Panel>
    </div>
  );
}
