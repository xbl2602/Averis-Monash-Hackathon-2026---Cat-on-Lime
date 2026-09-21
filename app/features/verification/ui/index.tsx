"use client";

import { useState, type FormEvent } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import { PipelineFlow } from "../../../_components/pipeline/pipeline-flow";
import { DEFAULT_LIMIT, DEFAULT_PROVIDER, LIMIT_PREF_KEY, PROVIDER_PREF_KEY, usePref } from "../../../_components/prefs";
import { postJson } from "../../../_lib/api-client";
import type { RunSummary as Summary } from "../../../_lib/contracts";
import type { ProviderOption } from "../../../_lib/provider-options";
import { RetryCard } from "./retry-card";
import { RunSummary } from "./run-summary";

const PREVIEW_MAX = 20;

function parseEmailIds(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

export function VerificationPanel({ providers }: { providers: ProviderOption[] }) {
  const { unlocked, adminRequest } = useAdmin();
  const [savedProvider] = usePref(PROVIDER_PREF_KEY, DEFAULT_PROVIDER);
  const [savedLimit] = usePref(LIMIT_PREF_KEY, DEFAULT_LIMIT);
  // null = the visitor has not touched the control, so the saved default from Settings applies
  const [providerChoice, setProviderChoice] = useState<string | null>(null);
  const [limitChoice, setLimitChoice] = useState<string | null>(null);
  const [emailIdsText, setEmailIdsText] = useState("");
  const [save, setSave] = useState(false);
  const [concurrency, setConcurrency] = useState(4);
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const provider = providerChoice ?? (providers.some((p) => p.id === savedProvider) ? savedProvider : providers[0]?.id ?? "");
  const selectedProvider = providers.find((p) => p.id === provider);
  // Saving is only possible with write access; without it the page stays a preview, as the public demo must
  const saving = save && unlocked;
  const limit = saving ? Number(limitChoice ?? "50") : Math.min(Number(limitChoice ?? savedLimit), PREVIEW_MAX);

  async function run(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    setSummary(null);
    const emailIds = parseEmailIds(emailIdsText);
    const body = {
      dry_run: !saving,
      provider,
      limit,
      concurrency,
      ...(saving && force ? { force: true } : {}),
      ...(emailIds.length > 0 ? { email_ids: emailIds } : {}),
    };
    const result = saving
      ? await adminRequest<Summary>("/features/pipeline/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await postJson<Summary>("/features/pipeline/api", body);
    setLoading(false);
    if (result.ok) setSummary(result.data);
    else setError(result.error);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="card space-y-6 p-6 sm:p-8">
        <div role="radiogroup" aria-label="Run mode" className="grid gap-3 sm:grid-cols-2">
          {[
            { value: false, icon: "eye" as const, title: "Preview", desc: "Calculate and show. Nothing is saved. Open to everyone, up to 20 emails." },
            { value: true, icon: "database" as const, title: "Save to database", desc: unlocked ? "Store every result so it shows up in Results, Conflicts and the export." : "Needs write access. Unlock it in the top bar first." },
          ].map((mode) => {
            const active = save === mode.value;
            const disabled = mode.value && !unlocked;
            return (
              <button key={mode.title} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => setSave(mode.value)} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-accent bg-accent/10 shadow-md" : "border-line bg-sunken hover:border-line-strong"}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-accent text-white" : "bg-accent/12 text-accent-strong"}`}>
                  <Icon name={disabled ? "lock" : mode.icon} size={20} />
                </span>
                <span>
                  <span className="block text-sm font-bold">{mode.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{mode.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

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

          {saving ? (
            <label className="block text-sm">
              <span className="mb-2 block font-semibold">Emails to process (1 to 520)</span>
              <input type="number" min={1} max={520} value={limitChoice ?? "50"} onChange={(e) => setLimitChoice(e.target.value)} className="field" />
              <span className="mt-1.5 block text-xs text-fg-faint">Long runs stop at a time limit; run again to carry on, finished ones are skipped.</span>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-2 flex justify-between font-semibold">
                Emails to process <span className="font-mono text-fg-muted">{limit}</span>
              </span>
              <input type="range" min={1} max={PREVIEW_MAX} value={limit} onChange={(e) => setLimitChoice(e.target.value)} className="mt-3 h-2 w-full cursor-pointer accent-[var(--accent)]" />
              <span className="mt-2.5 block text-xs text-fg-faint">Public previews are capped at 20 emails per run.</span>
            </label>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-2 block font-semibold">Specific email IDs (optional)</span>
          <input value={emailIdsText} onChange={(e) => setEmailIdsText(e.target.value)} placeholder="email_004, email_107" className="field font-mono !text-xs" />
          <span className="mt-1.5 block text-xs text-fg-faint">Leave empty to run the first emails in the inbox.</span>
        </label>

        <details className="group rounded-2xl border border-line bg-sunken">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold">
            <Icon name="sliders" size={18} className="text-accent-strong" />
            Advanced
            <Icon name="chevronDown" size={16} className="ml-auto text-fg-faint transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-5 px-4 pb-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 flex justify-between font-semibold">
                At the same time <span className="font-mono text-fg-muted">{concurrency}</span>
              </span>
              <input type="range" min={1} max={8} value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-[var(--accent)]" />
              <span className="mt-1.5 block text-xs text-fg-faint">More is faster but can hit model rate limits.</span>
            </label>
            <label className={`flex items-start gap-3 text-sm ${saving ? "" : "opacity-50"}`}>
              <input type="checkbox" checked={force} disabled={!saving} onChange={(e) => setForce(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
              <span>
                <span className="block font-semibold">Recalculate everything</span>
                <span className="mt-0.5 block text-xs text-fg-faint">Ignore saved results and redo them. Only when saving.</span>
              </span>
            </label>
          </div>
        </details>

        {selectedProvider && !selectedProvider.ready && (
          <Notice tone="warn" title={`${selectedProvider.label} is not available here`}>
            {selectedProvider.localOnly ? "Local models only work when the app runs on the same machine as the model." : "No API key is set for this model on the server. Pick another model from the list."}
          </Notice>
        )}
        {saving && (
          <Notice tone="warn" title="This run writes to the database">
            Results are stored for everyone using this server, replacing any older result for the same email.
          </Notice>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={loading || !provider} className="btn btn-primary btn-shine !px-7 !py-3">
            <Icon name={saving ? "database" : "play"} size={16} />
            {loading ? "Running…" : saving ? "Run and save" : "Run preview"}
          </button>
          {!saving && (
            <span className="chip !px-3.5 !py-1.5">
              <Icon name="shield" size={15} className="text-ok" />
              Preview only, nothing is saved
            </span>
          )}
        </div>
      </form>

      {loading && (
        <div className="card animate-rise p-6 sm:p-8">
          <PipelineFlow state="running" />
        </div>
      )}

      {error && <ErrorNotice error={error} />}
      {summary && <RunSummary summary={summary} onContinue={() => void run()} />}

      <RetryCard providers={providers} />
    </div>
  );
}
