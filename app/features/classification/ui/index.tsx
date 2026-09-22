"use client";

import { useState } from "react";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { EmailPicker } from "../../../_components/email-picker";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { Gauge } from "../../../_components/motion/gauge";
import { Notice } from "../../../_components/notice";
import { Badge } from "../../../_components/results/badges";
import { postJson } from "../../../_lib/api-client";
import { fileName, type EmailOption } from "../../../_lib/attachments";
import type { EmailCategory } from "../../../_lib/contracts";
import { CATEGORY_META } from "../../../_lib/labels";

interface ClassifyResponse {
  category: EmailCategory;
  confidence: number | null;
  needs_review: boolean;
}

function ResultCard({ result }: { result: ClassifyResponse }) {
  const meta = CATEGORY_META[result.category];
  return (
    <div className="card animate-pop relative overflow-hidden p-6 sm:p-8" aria-live="polite">
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: meta.color }} />
      <div className="relative flex flex-wrap items-center gap-6">
        <span className="animate-pop flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-white shadow-xl" style={{ background: meta.color }}>
          <Icon name={meta.icon} size={40} />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint">This email is a</div>
          <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl">{meta.label}</h2>
          <p className="mt-2 text-sm text-fg-muted">{meta.desc}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {result.needs_review ? <Badge tone="warn" icon="flag">A person should check</Badge> : <Badge tone="ok" icon="checkCircle">No review needed</Badge>}
            {result.category === "BL_COMPARISON" && <Badge tone="info" icon="compare">Goes on to extraction and comparison</Badge>}
          </div>
        </div>
        {result.confidence !== null && <Gauge value={result.confidence} label="confident" color={meta.color} />}
      </div>
    </div>
  );
}

export function ClassificationPanel({ emails }: { emails: EmailOption[] }) {
  const [emailId, setEmailId] = useState(emails.find((e) => e.email_id === "email_004")?.email_id ?? emails[0]?.email_id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const email = emails.find((e) => e.email_id === emailId);

  async function classify() {
    setLoading(true);
    setError(null);
    setResult(null);
    const response = await postJson<ClassifyResponse>("/features/classification/api", { email_id: emailId });
    setLoading(false);
    if (response.ok) setResult(response.data);
    else setError(response.error);
  }

  return (
    <div className="space-y-6">
      <Notice title="How it decides">
        It reads the message and its attachments, not just the subject line, and decides which of five kinds of email it is. Anything it cannot place with confidence is flagged for a person to check.
      </Notice>

      <div className="card space-y-5 p-6 sm:p-8">
        {emails.length === 0 ? (
          <Notice tone="warn" title="The sample inbox could not be read">This page classifies sample emails, so it needs the data in data/sample/inbox.</Notice>
        ) : (
          <>
            <EmailPicker emails={emails} value={emailId} onChange={(id) => { setEmailId(id); setResult(null); }} />

            {email && (
              <div className="animate-rise rounded-2xl border border-line bg-sunken p-4">
                <div className="text-sm font-semibold">{email.subject || "(no subject)"}</div>
                <div className="mt-0.5 text-xs text-fg-faint">{email.from}</div>
                {email.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {email.attachments.map((a) => (
                      <span key={a} className="chip !px-2.5 !py-1 font-mono !text-[11px]">
                        <Icon name="file" size={12} />
                        {fileName(a)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button type="button" onClick={classify} disabled={loading || !emailId} className="btn btn-primary btn-shine !px-7 !py-3">
              <Icon name="play" size={16} className={loading ? "animate-pulse" : ""} />
              {loading ? "Classifying…" : "Classify this email"}
            </button>
          </>
        )}
      </div>

      {error && <ErrorNotice error={error} />}
      {result && <ResultCard result={result} />}
    </div>
  );
}
