"use client";

import { useState } from "react";
import { Icon, type IconName } from "../../../_components/icon";
import { ErrorNotice } from "../../../_components/error-notice";
import { fetchFile, queryString } from "../../../_lib/api-client";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { downloadText, formatBytes } from "../../../_lib/format";
import { readCompleteness, type Completeness } from "./completeness";
import { CompletenessReport } from "./completeness-report";

export type ExportScope = "results" | "conflicts" | "stats" | "submission";
type ExportFormat = "json" | "md" | "txt" | "csv";

const SCOPES: Record<ExportScope, { icon: IconName; title: string; desc: string }> = {
  results: { icon: "table", title: "Results", desc: "Every email in the list, with the filters you set" },
  conflicts: { icon: "swap", title: "Conflicts", desc: "Mismatches and doubtful cases; CSV gives one row per field to amend" },
  stats: { icon: "chart", title: "Statistics", desc: "The numbers from the overview" },
  submission: { icon: "shield", title: "Official submission", desc: "The exact JSON file the organisers score" },
};

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "md", label: "Markdown" },
  { value: "txt", label: "Text" },
];

const MIME: Record<ExportFormat, string> = { json: "application/json", csv: "text/csv", md: "text/markdown", txt: "text/plain" };

interface Built {
  filename: string;
  text: string;
  format: ExportFormat;
  scope: ExportScope;
  report: Completeness;
}

/**
 * Builds an export in the browser (fetch, not a plain link) so the completeness headers can be read
 * before anything is saved. Filters passed in `filterParams` apply to the "results" scope.
 */
export function ExportPanel({
  scopes,
  initialScope,
  filterParams,
  conflictParams,
}: {
  scopes: ExportScope[];
  initialScope: ExportScope;
  filterParams?: Record<string, string | number | boolean | string[]>;
  conflictParams?: Record<string, string | number | boolean | string[]>;
}) {
  const [scope, setScope] = useState<ExportScope>(initialScope);
  const [format, setFormat] = useState<ExportFormat>("json");
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<Built | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  // The official submission is JSON only; switching to it snaps the format back
  const effectiveFormat: ExportFormat = scope === "submission" ? "json" : format;

  async function build() {
    setBusy(true);
    setError(null);
    setBuilt(null);
    const extra = scope === "results" ? filterParams : scope === "conflicts" ? conflictParams : undefined;
    const result = await fetchFile(`/features/results/api/export${queryString({ ...extra, scope, format: effectiveFormat })}`);
    setBusy(false);
    if (!result.ok) {
      setError(result.databaseDown ? { message: "Exports read saved results, and no database is connected to this server yet." } : result.error);
      return;
    }
    setBuilt({ filename: result.filename, text: result.text, format: effectiveFormat, scope, report: readCompleteness(result.headers) });
  }

  return (
    <div className="card animate-rise space-y-6 p-5 sm:p-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {scopes.map((key) => {
          const meta = SCOPES[key];
          const active = scope === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setScope(key);
                setBuilt(null);
              }}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${active ? "border-accent bg-accent/10 shadow-md" : "border-line bg-sunken hover:border-line-strong"}`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-accent text-white" : "bg-accent/12 text-accent-strong"}`}>
                <Icon name={meta.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{meta.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{meta.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div role="group" aria-label="File format" className="flex rounded-full border border-line bg-sunken p-1">
          {FORMATS.map((f) => {
            const disabled = scope === "submission" && f.value !== "json";
            return (
              <button
                key={f.value}
                type="button"
                disabled={disabled}
                onClick={() => setFormat(f.value)}
                aria-pressed={effectiveFormat === f.value}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-30 ${effectiveFormat === f.value ? "bg-surface-solid text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={build} disabled={busy} className="btn btn-primary btn-shine !px-6 !py-2.5">
          <Icon name={busy ? "refresh" : "sparkles"} size={17} className={busy ? "animate-spin" : ""} />
          {busy ? "Building…" : scope === "submission" ? "Build and check" : "Build file"}
        </button>
        {scope === "submission" && <span className="text-xs text-fg-faint">Only JSON is accepted for the official file.</span>}
      </div>

      {error && <ErrorNotice error={error} />}

      {built && (
        <div className="animate-rise space-y-5 border-t border-line pt-6">
          {built.scope === "submission" && <CompletenessReport report={built.report} />}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-sunken p-4">
            <div className="min-w-0">
              <div className="truncate font-mono text-sm font-semibold">{built.filename}</div>
              <div className="mt-0.5 text-xs text-fg-faint">
                {formatBytes(new Blob([built.text]).size)}
                {built.report.items > 0 && ` · ${built.report.items.toLocaleString("en-US")} items`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => downloadText(built.filename, built.text, MIME[built.format])}
              className={`btn btn-shine ${built.scope === "submission" && built.report.incomplete ? "btn-glass" : "btn-primary"}`}
            >
              <Icon name="download" size={17} />
              {built.scope === "submission" && built.report.incomplete ? "Download anyway" : "Download"}
            </button>
          </div>

          <details className="group rounded-2xl border border-line bg-code">
            <summary className="cursor-pointer px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-fg-faint transition hover:text-fg-muted">Preview</summary>
            <pre className="max-h-72 overflow-auto p-4 font-mono text-xs leading-relaxed">{built.text.slice(0, 4000)}{built.text.length > 4000 ? "\n…" : ""}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
