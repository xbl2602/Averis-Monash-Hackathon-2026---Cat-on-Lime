import Link from "next/link";
import { Icon, type IconName } from "../../../_components/icon";
import type { Completeness } from "./completeness";

interface Check {
  key: string;
  ok: boolean;
  /** "soft" checks explain something but do not make the file invalid */
  soft?: boolean;
  title: string;
  detail: string;
}

function buildChecks(c: Completeness): Check[] {
  const idText = (list: string[], total: number) => `${list.join(", ")}${total > list.length ? ` and ${total - list.length} more` : ""}`;
  return [
    {
      key: "present",
      ok: c.missing === 0,
      title: "Every official email is in the file",
      detail: c.missing === 0 ? `${c.items.toLocaleString("en-US")} results included.` : `${c.missing} missing: ${idText(c.missingIds, c.missing)}. Run the pipeline for them.`,
    },
    {
      key: "source",
      ok: c.expectedSource === "sample",
      title: "Checked against the official sample list",
      detail: c.expectedSource === "sample" ? "The expected count comes from the official inbox files." : "The official list could not be read, so the count was checked against the database only. Treat the file as unverified.",
    },
    {
      key: "stale",
      ok: c.stale === 0,
      title: "All results are from the current engine",
      detail: c.stale === 0 ? "No outdated results." : `${c.stale} were made by an older engine version: ${idText(c.staleIds, c.stale)}. Re-run them with “force”.`,
    },
    {
      key: "invalid",
      ok: c.invalid === 0,
      title: "No contradictory rows",
      detail: c.invalid === 0 ? "Every row is consistent (a mismatch lists its fields, a match lists none)." : `${c.invalid} rows contradict themselves: ${idText(c.invalidIds, c.invalid)}. Fix or re-run them first.`,
    },
    {
      key: "review",
      ok: c.reviewPending === 0 && c.reviewDeferred === 0,
      soft: true,
      title: "People have signed off the doubtful ones",
      detail:
        c.reviewPending === 0 && c.reviewDeferred === 0
          ? "Nothing is waiting for a person."
          : `${c.reviewPending} not yet reviewed, ${c.reviewDeferred} set aside. The file is still valid; review them to make it final.`,
    },
  ];
}

/** Pre-submission checklist read from the export headers. The verdict is the server's; the rows explain it. */
export function CompletenessReport({ report }: { report: Completeness }) {
  const checks = buildChecks(report);
  const good = !report.incomplete;

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-4 rounded-2xl p-4 ${good ? "animate-pop bg-ok-soft" : "animate-shake bg-bad-soft"}`}>
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${good ? "bg-ok text-white" : "bg-bad text-white"}`}>
          {good ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="animate-draw" strokeDasharray="30" d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <Icon name="alert" size={26} />
          )}
        </span>
        <div>
          <div className="text-base font-extrabold">{good ? "Ready to submit" : "Not ready to submit yet"}</div>
          <div className="text-xs text-fg-muted">
            {good ? "The file covers every official email and passed every check." : "Fix the red items below, or you may lose points on the missing or wrong rows."}
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {checks.map((check, i) => {
          const icon: IconName = check.ok ? "checkCircle" : check.soft ? "alert" : "xCircle";
          const color = check.ok ? "text-ok" : check.soft ? "text-warn" : "text-bad";
          return (
            <li key={check.key} style={{ "--i": i } as React.CSSProperties} className="animate-rise stagger flex items-start gap-3 rounded-2xl border border-line bg-sunken p-3.5">
              <Icon name={icon} size={20} className={`mt-0.5 shrink-0 ${color}`} />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{check.title}</div>
                <div className="mt-0.5 break-words text-xs text-fg-muted">{check.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>

      {(report.reviewPending > 0 || report.reviewDeferred > 0) && (
        <Link href="/features/review" className="btn btn-glass !py-2">
          <Icon name="flag" size={16} />
          Open the review queue
        </Link>
      )}
    </div>
  );
}
