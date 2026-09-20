"use client";

import { useState } from "react";
import { describeApiError, describeNetworkError, type ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { JsonResult } from "../../../_components/json-result";
import { Notice } from "../../../_components/notice";

// Example data with a deliberate MISMATCH (consignee), to show what a flagged result looks like
const EXAMPLE_SI = { shipper: "APRIL Fine Paper", consignee: "ABC Trading Co" };
const EXAMPLE_BL = { shipper: "APRIL Fine Paper", consignee: "XYZ Trading Co" };

export function ComparisonPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  async function runExample() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/features/comparison/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ si: EXAMPLE_SI, bl: EXAMPLE_BL }),
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
      <Notice title="How it compares">
        Values are normalised first, so case, punctuation and number formats don&rsquo;t cause false alarms. Wording
        differences get a second look from the Jev model, while numbers are always compared exactly. When it can&rsquo;t
        decide, the result is marked <span className="font-mono">NEEDS_REVIEW</span>.
      </Notice>

      <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-lg font-bold">Try it on example data</h2>
          <p className="mt-1 text-sm text-fg-muted">The consignee is deliberately different between the SI and the BL.</p>
        </div>
        <button onClick={runExample} disabled={loading} className="btn btn-primary !px-7 !py-3">
          <Icon name="play" size={16} />
          {loading ? "Comparing…" : "Run comparison"}
        </button>
      </div>

      {error && <ErrorNotice error={error} />}
      {result && <JsonResult data={result} />}
    </div>
  );
}
