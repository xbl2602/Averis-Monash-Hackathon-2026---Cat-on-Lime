"use client";

import { useEffect, useRef } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { LockedCard } from "../../../_components/admin/admin-gate";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { CountUp } from "../../../_components/motion/count-up";
import { useRunStatus } from "../../../_components/run-status";
import { useToast } from "../../../_components/toast";
import type { RunSummary as Summary, StatsSummary } from "../../../_lib/contracts";
import type { ProviderOption } from "../../../_lib/provider-options";
import { useApi } from "../../../_lib/use-api";
import { RunSummary } from "./run-summary";

/** Emails whose model step failed, or that were answered by a fallback: one button re-runs just those. */
export function RetryCard({ providers }: { providers: ProviderOption[] }) {
  const stats = useApi<StatsSummary>("/features/results/api/stats");
  const { unlocked, adminRequest } = useAdmin();
  const toast = useToast();
  // Tracked app-wide: this run keeps going (and stays visible) if you switch pages mid-retry
  const retryRun = useRunStatus<Summary>("pipeline-retry");
  const busy = retryRun.running;
  const summary = retryRun.result?.ok ? retryRun.result.data : null;
  const failure = retryRun.result && !retryRun.result.ok ? retryRun.result : null;
  // 401/403 already lock the tab and raise a toast in AdminProvider; a second notice here is noise
  const error = failure && failure.status !== 401 && failure.status !== 403 ? failure.error : null;
  const finishedAt = retryRun.record?.finishedAt ?? null;

  // The counts behind this card are stale once a retry finishes, including a retry finished on
  // another page; reload them whenever a run completes rather than only right after our own click.
  const seenFinishRef = useRef<number | null>(null);
  useEffect(() => {
    if (finishedAt === null || seenFinishRef.current === finishedAt) return;
    seenFinishRef.current = finishedAt;
    stats.reload();
  }, [finishedAt, stats]);

  // No database means there is nothing saved to retry; the card would only be noise
  if (stats.databaseDown || (!stats.data && !stats.loading)) return null;

  const failed = stats.data?.failed ?? 0;
  const degraded = Object.entries(stats.data?.providers ?? {})
    .filter(([name]) => name.includes("degraded"))
    .reduce((sum, [, count]) => sum + count, 0);
  const total = failed + degraded;
  const provider = providers.find((p) => p.id === "gemini")?.id ?? providers[0]?.id;

  async function retry() {
    const result = await retryRun.start({
      label: "Retrying failed emails",
      href: "/features/verification#retry",
      task: () =>
        adminRequest<Summary>("/features/pipeline/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retry_failed: true, dry_run: false, ...(provider ? { provider } : {}) }),
        }),
    });
    if (!result?.ok) return;
    toast({ tone: result.data.failed > 0 ? "warn" : "ok", title: result.data.ran === 0 ? "Nothing needed a retry" : `Retried ${result.data.ran} emails` });
  }

  return (
    <section id="retry" className="card scroll-mt-24 space-y-5 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-5">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ${total > 0 ? "bg-bad" : "bg-ok"}`}>
          <Icon name={total > 0 ? "refresh" : "checkCircle"} size={28} className={busy ? "animate-spin" : ""} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Retry failed and fallback results</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {stats.loading && !stats.data ? (
              "Checking what needs a retry…"
            ) : total === 0 ? (
              "Nothing failed and no fallback answers were used. All good."
            ) : (
              <>
                <span className="font-bold text-fg"><CountUp value={failed} /></span> failed to process and <span className="font-bold text-fg"><CountUp value={degraded} /></span> were answered by a fallback because a model step was down. Re-run just these.
              </>
            )}
          </p>
        </div>
        <button type="button" onClick={() => void retry()} disabled={busy || !unlocked || total === 0} className="btn btn-primary btn-shine !px-6 !py-3">
          <Icon name="refresh" size={17} />
          {busy ? "Retrying…" : "Retry them"}
        </button>
      </div>
      {!unlocked && total > 0 && <LockedCard action="re-run these emails" />}
      {error && <ErrorNotice error={error} />}
      {summary && <RunSummary summary={summary} />}
    </section>
  );
}
