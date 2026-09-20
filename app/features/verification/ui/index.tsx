"use client";

import { useState, type FormEvent } from "react";
import { describeApiError, describeNetworkError, type ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import { DEFAULT_LIMIT, DEFAULT_PROVIDER, LIMIT_PREF_KEY, PROVIDER_PREF_KEY, usePref } from "../../../_components/prefs";
import type { ProviderOption } from "../../../_lib/provider-options";

// Fields of the pipeline's batch summary that this screen shows (contract: SHARED_INTERFACES.md, "pipeline")
interface RunSummary {
  total_emails: number;
  selected: number;
  skipped: number;
  ran: number;
  succeeded: number;
  failed: number;
  wrote: number;
  remaining: number;
  stopped_by_deadline: boolean;
  duration_ms: number;
  failures: { email_id: string; error: string }[];
}

function parseEmailIds(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "bad" | "ok" }) {
  const color = tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "";
  return (
    <div className="rounded-2xl border border-line bg-sunken p-4">
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-fg-muted">{label}</div>
    </div>
  );
}

export function VerificationPanel({ providers }: { providers: ProviderOption[] }) {
  const [savedProvider] = usePref(PROVIDER_PREF_KEY, DEFAULT_PROVIDER);
  const [savedLimit] = usePref(LIMIT_PREF_KEY, DEFAULT_LIMIT);
  // null = the visitor has not touched the control, so the saved default from Settings applies
  const [providerChoice, setProviderChoice] = useState<string | null>(null);
  const [limitChoice, setLimitChoice] = useState<string | null>(null);
  const [emailIdsText, setEmailIdsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const provider = providerChoice ?? (providers.some((p) => p.id === savedProvider) ? savedProvider : providers[0]?.id ?? "");
  const limit = limitChoice ?? savedLimit;
  const selectedProvider = providers.find((p) => p.id === provider);

  async function runPreview(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const emailIds = parseEmailIds(emailIdsText);
      // Public page: always a dry run. Writing results needs an admin token and has no button here.
      const body = {
        dry_run: true,
        provider,
        limit: Number(limit),
        ...(emailIds.length > 0 ? { email_ids: emailIds } : {}),
      };
      const res = await fetch("/features/pipeline/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(describeApiError(res.status, data));
        return;
      }
      setSummary(data as RunSummary);
    } catch {
      setError(describeNetworkError());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={runPreview} className="card space-y-5 p-6 sm:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-semibold">Fallback model</span>
            <select value={provider} onChange={(e) => setProviderChoice(e.target.value)} className="field">
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.ready ? "" : p.localOnly ? " · local only" : " · key missing"}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-fg-faint">Rules run first; the model only steps in when they can&rsquo;t settle a field.</span>
          </label>

          <label className="block text-sm">
            <span className="mb-2 flex justify-between font-semibold">
              Emails to process <span className="font-mono text-fg-muted">{limit}</span>
            </span>
            <input
              type="range"
              min={1}
              max={20}
              value={Number(limit)}
              onChange={(e) => setLimitChoice(e.target.value)}
              className="mt-3 h-2 w-full cursor-pointer accent-[var(--accent)]"
            />
            <span className="mt-2.5 block text-xs text-fg-faint">Public previews are capped at 20 emails per run.</span>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-2 block font-semibold">Specific email IDs (optional)</span>
          <input
            value={emailIdsText}
            onChange={(e) => setEmailIdsText(e.target.value)}
            placeholder="email_004, email_107"
            className="field font-mono !text-xs"
          />
          <span className="mt-1.5 block text-xs text-fg-faint">Leave empty to run the first emails in the inbox.</span>
        </label>

        {selectedProvider && !selectedProvider.ready && (
          <Notice tone="warn" title={`${selectedProvider.label} is not available here`}>
            {selectedProvider.localOnly
              ? "Local models only work when the app runs on the same machine as the model."
              : "No API key is set for this model on the server. Pick another model from the list."}
          </Notice>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={loading || !provider} className="btn btn-primary !px-7 !py-3">
            <Icon name="play" size={16} />
            {loading ? "Running preview…" : "Run preview"}
          </button>
          <span className="chip !px-3.5 !py-1.5">
            <Icon name="shield" size={15} className="text-ok" />
            Preview only, nothing is saved
          </span>
        </div>
      </form>

      {error && <ErrorNotice error={error} />}

      {summary && (
        <div className="card space-y-5 p-6 sm:p-8" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Preview complete</h2>
            <span className="text-xs text-fg-faint">{(summary.duration_ms / 1000).toFixed(1)}s</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Emails selected" value={summary.selected} />
            <Stat label="Processed" value={summary.ran} />
            <Stat label="Succeeded" value={summary.succeeded} tone="ok" />
            <Stat label="Failed" value={summary.failed} tone={summary.failed > 0 ? "bad" : undefined} />
          </div>

          {summary.remaining > 0 && (
            <Notice tone="info" title={`${summary.remaining} more emails are not covered by this run`}>
              {summary.stopped_by_deadline
                ? "The run hit its time limit. Run it again to continue."
                : `Public previews always start from the top of the inbox and cover at most 20 emails, so running again shows the same ones. This run selected ${summary.selected}; ${summary.remaining} remain.`}
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
              {summary.wrote === 0 && "Nothing was written to the database."}
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}
