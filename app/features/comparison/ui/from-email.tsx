"use client";

import { useState } from "react";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { EmailPicker } from "../../../_components/email-picker";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import { PipelineFlow, type FlowState } from "../../../_components/pipeline/pipeline-flow";
import { postJson } from "../../../_lib/api-client";
import { attachmentKind, fileName, type EmailOption } from "../../../_lib/attachments";
import type { ExtractDocumentResult } from "../../../_lib/contracts";
import { ComparisonOutcome, type ComparisonOutcomeData } from "./comparison-outcome";

/** Pick a sample email: its SI and BL are read, then compared. The same steps the full pipeline runs for one email. */
export function FromEmail({ emails }: { emails: EmailOption[] }) {
  const [emailId, setEmailId] = useState(emails.find((e) => e.email_id === "email_004")?.email_id ?? emails[0]?.email_id ?? "");
  const [flow, setFlow] = useState<FlowState>("idle");
  const [outcome, setOutcome] = useState<ComparisonOutcomeData | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const email = emails.find((e) => e.email_id === emailId);
  const siPath = email?.attachments.find((a) => attachmentKind(a) === "SI");
  const blPath = email?.attachments.find((a) => attachmentKind(a) === "BL");
  const complete = Boolean(siPath && blPath);

  async function run() {
    if (!siPath || !blPath) return;
    setFlow("running");
    setError(null);
    setOutcome(null);
    const [si, bl] = await Promise.all([
      postJson<ExtractDocumentResult>("/features/extraction/api", { attachment_path: siPath, documentType: "SI" }),
      postJson<ExtractDocumentResult>("/features/extraction/api", { attachment_path: blPath, documentType: "BL" }),
    ]);
    const failed = !si.ok ? si : !bl.ok ? bl : null;
    if (failed || !si.ok || !bl.ok) {
      setError(failed?.error ?? { message: "The documents could not be read." });
      setFlow("failed");
      return;
    }
    const comparison = await postJson<ComparisonOutcomeData["comparison"]>("/features/comparison/api", { si: si.data.fields, bl: bl.data.fields });
    if (!comparison.ok) {
      setError(comparison.error);
      setFlow("failed");
      return;
    }
    setOutcome({ comparison: comparison.data, si: si.data.fields, bl: bl.data.fields, siEvidence: si.data.evidence, blEvidence: bl.data.evidence });
    setFlow("done");
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5 p-6 sm:p-8">
        <EmailPicker emails={emails} value={emailId} onChange={(id) => { setEmailId(id); setOutcome(null); setFlow("idle"); }} />

        {email && (
          <div className="animate-rise flex flex-wrap items-center gap-3">
            {[{ kind: "SI", path: siPath }, { kind: "BL", path: blPath }].map((doc) => (
              <span key={doc.kind} className={`chip !px-3 !py-1.5 font-mono !text-[11px] ${doc.path ? "" : "!border-warn/50 !text-warn"}`}>
                <Icon name={doc.path ? "file" : "alert"} size={13} />
                {doc.kind}: {doc.path ? fileName(doc.path) : "missing"}
              </span>
            ))}
          </div>
        )}
        {email && !complete && (
          <Notice tone="warn" title="This email does not have both documents">
            The pipeline marks emails like this NEEDS_REVIEW (missing attachment) instead of guessing. Pick an email with an SI and a BL to compare.
          </Notice>
        )}

        <button type="button" onClick={run} disabled={!complete || flow === "running"} className="btn btn-primary btn-shine !px-7 !py-3">
          <Icon name="play" size={16} />
          {flow === "running" ? "Comparing…" : "Read both and compare"}
        </button>
      </div>

      {flow !== "idle" && (
        <div className="card animate-rise p-6 sm:p-8">
          <PipelineFlow state={flow} />
        </div>
      )}
      {error && <ErrorNotice error={error} />}
      {outcome && <ComparisonOutcome data={outcome} />}
    </div>
  );
}
