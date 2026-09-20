"use client";

import { useState } from "react";
import { describeApiError, describeNetworkError, type ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { JsonResult } from "../../../_components/json-result";
import { Notice } from "../../../_components/notice";

const EXAMPLE_EMAIL_ID = "email_004";

export function ClassificationPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  async function runExample() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/features/classification/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: EXAMPLE_EMAIL_ID }),
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
      <Notice title="How it decides">
        Rules go first. If they are unsure, the Jev decision model is asked, and a text model is the last resort.
        Anything still unclear is flagged for a person to review.
      </Notice>

      <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-lg font-bold">Try it on a sample email</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Classifies the sample email <span className="font-mono">{EXAMPLE_EMAIL_ID}</span>.
          </p>
        </div>
        <button onClick={runExample} disabled={loading} className="btn btn-primary !px-7 !py-3">
          <Icon name="play" size={16} />
          {loading ? "Classifying…" : "Run classification"}
        </button>
      </div>

      {error && <ErrorNotice error={error} />}
      {result && <JsonResult data={result} />}
    </div>
  );
}
