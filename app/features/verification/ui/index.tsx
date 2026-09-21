"use client";

import { useState, type FormEvent } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import { PipelineFlow } from "../../../_components/pipeline/pipeline-flow";
import { DEFAULT_LIMIT, DEFAULT_PROVIDER, LIMIT_PREF_KEY, PROVIDER_PREF_KEY, usePref } from "../../../_components/prefs";
import { useRunStatus } from "../../../_components/run-status";
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
  // Tracked app-wide, so leaving this page mid-run no longer hides the run or loses its result
  const pipelineRun = useRunStatus<Summary>("pipeline-run");
  const loading = pipelineRun.running;
  const summary = pipelineRun.result?.ok ? pipelineRun.result.data : null;
  const error = pipelineRun.result && !pipelineRun.result.ok ? pipelineRun.result.error : null;

  const provider = providerChoice ?? (providers.some((p) => p.id === savedProvider) ? savedProvider : providers[0]?.id ?? "");
  const selectedProvider = providers.find((p) => p.id === provider);
  // Saving is only possible with write access; without it the page stays a preview, as the public demo must
  const saving = save && unlocked;
  // Default to "the whole inbox" once saving, not some arbitrary smaller number — the obvious
  // expectation for "run it for real" is "run all 520", not a partial batch you have to type in.
  const limit = saving ? Number(limitChoice ?? "520") : Math.min(Number(limitChoice ?? savedLimit), PREVIEW_MAX);

  async function run(event?: FormEvent) {
    event?.preventDefault();
    const emailIds = parseEmailIds(emailIdsText);
    const body = {
      dry_run: !saving,
      provider,
      limit,
      concurrency,
      ...(saving && force ? { force: true } : {}),
      ...(emailIds.length > 0 ? { email_ids: emailIds } : {}),
    };
    await pipelineRun.start({
      label: saving ? "Full pipeline run" : "Pipeline preview",
      href: "/features/verification",
      task: () =>
        saving
          ? adminRequest<Summary>("/features/pipeline/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          : postJson<Summary>("/features/pipeline/api", body),
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="card space-y-6 p-6 sm:p-8">
        {!unlocked && (
          <Notice tone="info" title="This page is open to everyone as a try-it-out preview">
            Anyone visiting this site can try the pipeline here, but only on the first 20 emails and without saving anything — that limit exists so a public demo can&rsquo;t rack up model costs or overwrite real data by accident. Unlock write access in the top bar to run it for real, on all 520 emails, and save the results.
          </Notice>
        )}

        <div role="radiogroup" aria-label="Run mode" className="grid gap-3 sm:grid-cols-2">
          {[
            { value: false, icon: "eye" as const, title: "Preview", desc: "Calculate and show. Nothing is saved. Open to everyone, up to 20 emails." },
            { value: true, icon: "database" as const, title: "Save to database", desc: unlocked ? "The real run: process the inbox and store every result so it shows up in Results, Conflicts and the export." : "Needs write access. Unlock it in the top bar first." },
          ].map((mode) => {
            const active = save === mode.value;
            const disabled = mode.value && !unlocked;
            return (
              <button
                key={mode.title}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => {
                  setSave(mode.value);
                  // Fresh default for whichever mode you land on, instead of carrying over a
                  // number typed for the other mode (a preview-sized 15 leaking into "save", say).
                  setLimitChoice(null);
                }}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-accent bg-accent/10 shadow-md" : "border-line bg-sunken hover:border-line-strong"}`}
              >
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
            <span className="mb-2 block font-semibold">Preferred model</span>
            <select value={provider} onChange={(e) => setProviderChoice(e.target.value)} className="field">
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.ready ? "" : p.localOnly ? " · local only" : " · key missing"}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-fg-faint">
              Rules run first and settle most fields without any model. When one is needed, this model goes first; if it fails or has no key, the app automatically tries the other configured models next, in order.
            </span>
          </label>

          {saving ? (
            <label className="block text-sm">
              <span className="mb-2 block font-semibold">How many to run this time (1 to 520)</span>
              <input type="number" min={1} max={520} value={limitChoice ?? "520"} onChange={(e) => setLimitChoice(e.target.value)} className="field" />
              <span className="mt-1.5 block text-xs leading-relaxed text-fg-faint">
                Defaults to the whole inbox. Emails already processed with the current model version are skipped automatically, so re-running with 520 after a first pass is cheap — it only does the ones still missing or changed. Want to force a full redo instead (e.g. after switching models)? Turn on &ldquo;Recalculate everything&rdquo; under Advanced below.
              </span>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-2 flex justify-between font-semibold">
                How many to run this time <span className="font-mono text-fg-muted">{limit}</span>
              </span>
              <input type="range" min={1} max={PREVIEW_MAX} value={limit} onChange={(e) => setLimitChoice(e.target.value)} className="mt-3 h-2 w-full cursor-pointer accent-[var(--accent)]" />
              <span className="mt-2.5 block text-xs text-fg-faint">A cap on this one run. Public previews are capped at 20 emails per run either way.</span>
            </label>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-2 block font-semibold">Only these email IDs (optional)</span>
          <input value={emailIdsText} onChange={(e) => setEmailIdsText(e.target.value)} placeholder="email_004, email_107" className="field font-mono !text-xs" />
          <span className="mt-1.5 block text-xs text-fg-faint">
            Leave empty to run the first emails in the inbox instead. The cap above still applies even when you list IDs here — list more IDs than the cap and only the first ones (after already-finished ones are skipped) run this time.
          </span>
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
                <span className="mt-0.5 block text-xs text-fg-faint">Ignore saved results and redo them. Only when saving. Decisions made in the Review queue are kept; to replace one with a fresh system answer, re-run that email from the Review queue.</span>
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
        {saving && (
          <p className="text-xs leading-relaxed text-fg-faint">
            One click processes as many as it can in about 30 seconds, since each email may need a live model call. If 520 don&rsquo;t finish in that window, the summary below will say how many are left and give you a &ldquo;Continue&rdquo; button — click it (or just run again) until it reports none left.
          </p>
        )}
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
