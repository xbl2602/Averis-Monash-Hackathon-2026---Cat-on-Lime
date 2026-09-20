"use client";

import { useState } from "react";
import { describeApiError, describeNetworkError, type ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { JsonResult } from "../../../_components/json-result";
import { Notice } from "../../../_components/notice";

const EXAMPLE_ATTACHMENT = "attachments/email_004_SI.txt";

export function ExtractionPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  async function runExample() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/features/extraction/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachment_path: EXAMPLE_ATTACHMENT,
          documentType: "SI",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(describeApiError(res.status, data));
        return;
      }
      setResult(JSON.stringify(data, null, 2));
    } catch {
      setError(describeNetworkError());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Notice title="How it reads a document">
        Label-based rules read the fields first, so &ldquo;Load Port&rdquo; and &ldquo;Port of Loading&rdquo; land in the
        same field. A model is only asked for fields the rules could not find. Supports PDF, Word, Excel and text files.
      </Notice>

      <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-lg font-bold">Try it on a sample attachment</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Extracts the fields from <span className="font-mono">{EXAMPLE_ATTACHMENT}</span>.
          </p>
        </div>
        <button onClick={runExample} disabled={loading} className="btn btn-primary !px-7 !py-3">
          <Icon name="play" size={16} />
          {loading ? "Extracting…" : "Run extraction"}
        </button>
      </div>

      {error && <ErrorNotice error={error} />}
      {result && <JsonResult data={result} />}
    </div>
  );
}
