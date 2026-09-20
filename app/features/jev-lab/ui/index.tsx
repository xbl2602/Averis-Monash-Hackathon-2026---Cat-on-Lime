"use client";

import { useState } from "react";
import { describeApiError, describeNetworkError, type ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";

interface EmailOption {
  email_id: string;
  subject: string;
}

interface ClassifyResponse {
  category: string;
  confidence: number | null;
  needs_review: boolean;
}

const PROVIDERS = [
  { id: "jev", label: "Jev (structured decisions)" },
  { id: "claude", label: "Claude (Anthropic, for comparison)" },
];

const CATEGORY_LABELS: Record<string, { name: string; desc: string }> = {
  BL_COMPARISON: { name: "BL comparison", desc: "A draft BL was sent to be checked against the SI" },
  SI_REQUEST: { name: "SI request", desc: "A Shipping Instruction was sent or requested" },
  INVOICE_QUERY: { name: "Invoice query", desc: "A question about an invoice, charges or payment" },
  GENERAL: { name: "General", desc: "Other normal shipping business" },
  SPAM: { name: "Spam", desc: "Advertising, phishing or unrelated to shipping" },
};

export function JevLabPanel({ emails }: { emails: EmailOption[] }) {
  const [emailId, setEmailId] = useState(emails[0]?.email_id ?? "");
  const [provider, setProvider] = useState("jev");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [ranProvider, setRanProvider] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  async function runClassification() {
    setLoading(true);
    setError(null);
    setResult(null);
    setRanProvider(null);
    try {
      const res = await fetch("/features/classification/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: emailId, provider }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(describeApiError(res.status, data));
        return;
      }
      setResult(data as ClassifyResponse);
      setRanProvider(provider);
    } catch {
      setError(describeNetworkError());
    } finally {
      setLoading(false);
    }
  }

  const confidencePct = result && result.confidence !== null ? Math.round(result.confidence * 100) : null;
  const category = result ? CATEGORY_LABELS[result.category] : undefined;

  return (
    <div className="space-y-5">
      <div className="card p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-2 block font-semibold">Sample email</span>
            <select value={emailId} onChange={(e) => setEmailId(e.target.value)} className="field">
              {emails.map((email) => (
                <option key={email.email_id} value={email.email_id}>
                  {email.email_id} — {email.subject.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-semibold">Model</span>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="field">
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button onClick={runClassification} disabled={loading || !emailId} className="btn btn-primary mt-6 !px-7 !py-3">
          <Icon name="play" size={16} />
          {loading ? "Running…" : "Run classification"}
        </button>
      </div>

      {error && <ErrorNotice error={error} />}

      {result && (
        <div className="card space-y-4 p-6 sm:p-8" aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-fg px-4 py-1.5 text-sm font-semibold text-page">{category?.name ?? result.category}</span>
            <span className="font-mono text-xs text-fg-faint">{result.category}</span>
            <span
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                result.needs_review ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"
              }`}
            >
              <Icon name={result.needs_review ? "users" : "check"} size={14} />
              {result.needs_review ? "Needs human review" : "Can be handled automatically"}
            </span>
          </div>

          <p className="text-sm text-fg-muted">{category?.desc ?? "Unknown category"}</p>

          {confidencePct !== null ? (
            <div>
              <div className="flex justify-between text-xs text-fg-muted">
                <span>Confidence (calibrated by Jev)</span>
                <span className="font-mono">{confidencePct}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-sunken">
                <div className="h-2.5 rounded-full bg-accent" style={{ width: `${confidencePct}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-fg-faint">
              This model ({ranProvider}) does not return a calibrated confidence, so there is no review decision.
            </p>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-fg-muted hover:text-fg">Raw JSON response</summary>
            <pre className="mt-2 overflow-auto rounded-2xl bg-code p-4 font-mono text-xs">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
