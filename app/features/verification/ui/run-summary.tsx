"use client";

import Link from "next/link";
import { Icon } from "../../../_components/icon";
import { CountUp } from "../../../_components/motion/count-up";
import { Notice } from "../../../_components/notice";
import { PipelineFlow } from "../../../_components/pipeline/pipeline-flow";
import type { RunSummary as Summary } from "../../../_lib/contracts";

function Stat({ label, value, tone, index }: { label: string; value: number; tone?: "bad" | "ok"; index: number }) {
  const color = tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "";
  return (
    <div style={{ "--i": index } as React.CSSProperties} className="animate-pop stagger rounded-2xl border border-line bg-sunken p-4">
      <div className={`text-3xl font-extrabold ${color}`}>
        <CountUp value={value} duration={800} />
      </div>
      <div className="mt-1 text-xs text-fg-muted">{label}</div>
    </div>
  );
}

/** What a batch run did: the pipeline lighting up, the counts, why anything was left over, and where to look next. */
export function RunSummary({ summary, onContinue }: { summary: Summary; onContinue?: () => void }) {
  const saved = !summary.dry_run;
  return (
    <div className="card animate-rise space-y-6 p-6 sm:p-8" aria-live="polite">
      <PipelineFlow state={summary.failed > 0 && summary.succeeded === 0 ? "failed" : "done"} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{saved ? "Run complete, results saved" : "Preview complete"}</h2>
        <span className="text-xs text-fg-faint">
          {(summary.duration_ms / 1000).toFixed(1)}s · engine {summary.logic_version}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat index={0} label="Selected" value={summary.selected} />
        <Stat index={1} label="Skipped (already done)" value={summary.skipped} />
        <Stat index={2} label="Succeeded" value={summary.succeeded} tone="ok" />
        <Stat index={3} label="Failed" value={summary.failed} tone={summary.failed > 0 ? "bad" : undefined} />
        <Stat index={4} label="Saved to database" value={summary.wrote} />
      </div>

      {summary.remaining > 0 && (
        <Notice tone="info" title={`${summary.remaining} more emails are not covered by this run`}>
          {summary.stopped_by_deadline
            ? "The run hit its time limit. Run it again to continue; anything already saved is skipped."
            : saved
              ? "The limit was reached. Raise it or run again to carry on."
              : `Public previews always start from the top of the inbox and cover at most 20 emails, so running again shows the same ones. This run selected ${summary.selected}; ${summary.remaining} remain.`}
          {summary.stopped_by_deadline && onContinue && (
            <div className="mt-3">
              <button type="button" onClick={onContinue} className="btn btn-glass !py-2">
                <Icon name="play" size={15} />
                Continue
              </button>
            </div>
          )}
        </Notice>
      )}

      {summary.failures.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Emails that failed</h3>
          <ul className="mt-3 space-y-2">
            {summary.failures.map((f) => (
              <li key={f.email_id} className="rounded-2xl border border-line bg-bad-soft p-3 text-xs">
                <span className="font-mono font-semibold">{f.email_id}</span>
                <span className="ml-2 break-words text-fg-muted">{f.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.failed === 0 && summary.remaining === 0 && (
        <Notice tone="ok" title="Every selected email was processed.">
          {saved ? `${summary.wrote} results were written to the database.` : "Nothing was written to the database."}
        </Notice>
      )}

      {saved && (
        <div className="flex flex-wrap gap-3">
          <Link href="/features/results" className="btn btn-primary btn-shine !py-2.5">
            <Icon name="table" size={16} />
            See the results
          </Link>
          <Link href="/features/results/conflicts" className="btn btn-glass !py-2.5">
            <Icon name="swap" size={16} />
            Conflicts
          </Link>
          <Link href="/features/review" className="btn btn-glass !py-2.5">
            <Icon name="flag" size={16} />
            Review queue
          </Link>
        </div>
      )}
    </div>
  );
}
