"use client";

import { useState } from "react";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { EmailPicker } from "../../../_components/email-picker";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import { ExtractionCard } from "../../../_components/results/extraction-card";
import { postJson } from "../../../_lib/api-client";
import { attachmentKind, fileName, type EmailOption } from "../../../_lib/attachments";
import type { ExtractDocumentResult } from "../../../_lib/contracts";
import type { ProviderOption } from "../../../_lib/provider-options";

export function ExtractionPanel({ emails, providers }: { emails: EmailOption[]; providers: ProviderOption[] }) {
  const [emailId, setEmailId] = useState(emails.find((e) => e.email_id === "email_004")?.email_id ?? emails[0]?.email_id ?? "");
  const email = emails.find((e) => e.email_id === emailId);
  const [attachment, setAttachment] = useState("");
  const [typeChoice, setTypeChoice] = useState<"SI" | "BL">("SI");
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; data: ExtractDocumentResult } | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  // Default to the first attachment of the chosen email until the visitor picks another
  const chosen = email?.attachments.includes(attachment) ? attachment : (email?.attachments[0] ?? "");
  const detected = chosen ? attachmentKind(chosen) : null;
  const documentType = detected ?? typeChoice;

  async function extract() {
    setLoading(true);
    setError(null);
    setResult(null);
    const response = await postJson<ExtractDocumentResult>("/features/extraction/api", {
      attachment_path: chosen,
      documentType,
      ...(provider ? { provider } : {}),
    });
    setLoading(false);
    if (response.ok) setResult({ title: `What was read from ${fileName(chosen)}`, data: response.data });
    else setError(response.error);
  }

  return (
    <div className="space-y-6">
      <Notice title="How it reads a document">
        Label-based rules read the fields first, so &ldquo;Load Port&rdquo; and &ldquo;Port of Loading&rdquo; land in the same field. A model is only asked for fields the rules could not find. Supports PDF, Word, Excel and text files.
      </Notice>

      <div className="card space-y-5 p-6 sm:p-8">
        {emails.length === 0 ? (
          <Notice tone="warn" title="The sample inbox could not be read">This page reads sample attachments, so it needs the data in data/sample.</Notice>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
              <EmailPicker emails={emails} value={emailId} onChange={(id) => { setEmailId(id); setAttachment(""); setResult(null); }} />
              <label className="block text-sm">
                <span className="mb-2 block font-semibold">Fallback model</span>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className="field">
                  <option value="">Default (Gemini, only if needed)</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {p.ready ? "" : p.localOnly ? " · local only" : " · key missing"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {email && email.attachments.length === 0 && <Notice tone="warn" title="This email has no attachments">There is nothing to extract. In the full pipeline this becomes a &ldquo;missing attachment&rdquo; review case.</Notice>}

            {email && email.attachments.length > 0 && (
              <div className="animate-rise space-y-3">
                <div className="text-sm font-semibold">Attachment</div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Attachment">
                  {email.attachments.map((a) => {
                    const active = a === chosen;
                    return (
                      <button key={a} type="button" role="radio" aria-checked={active} onClick={() => { setAttachment(a); setResult(null); }} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs transition active:scale-95 ${active ? "border-accent bg-accent/15 text-fg" : "border-line bg-sunken text-fg-muted hover:border-line-strong"}`}>
                        <Icon name="file" size={14} />
                        {fileName(a)}
                        {attachmentKind(a) && <span className="rounded-full bg-accent/20 px-1.5 text-[10px] font-bold text-accent-strong">{attachmentKind(a)}</span>}
                      </button>
                    );
                  })}
                </div>
                {!detected && chosen && (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-fg-muted">The file name does not say what it is. Read it as:</span>
                    {(["SI", "BL"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setTypeChoice(t)} aria-pressed={typeChoice === t} className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${typeChoice === t ? "border-accent bg-accent/15" : "border-line bg-sunken"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button type="button" onClick={extract} disabled={loading || !chosen} className="btn btn-primary btn-shine !px-7 !py-3">
              <Icon name="play" size={16} className={loading ? "animate-pulse" : ""} />
              {loading ? "Reading…" : "Extract the fields"}
            </button>
          </>
        )}
      </div>

      {error && <ErrorNotice error={error} />}
      {result && <ExtractionCard title={result.title} result={result.data} />}
    </div>
  );
}
