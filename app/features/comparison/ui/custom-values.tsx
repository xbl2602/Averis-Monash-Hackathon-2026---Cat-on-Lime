"use client";

import { useState } from "react";
import { COMPARED_FIELDS } from "@/lib/shared/types";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { postJson } from "../../../_lib/api-client";
import type { FieldValues } from "../../../_lib/contracts";
import { fieldLabel } from "../../../_lib/labels";
import { ComparisonOutcome, type ComparisonOutcomeData } from "./comparison-outcome";

// A deliberate consignee difference, so the first click shows what a flagged result looks like
const EXAMPLE_SI: FieldValues = { shipper: "APRIL Fine Paper", consignee: "ABC Trading Co", notify_party: "ABC Logistics", port_of_loading: "Singapore", port_of_discharge: "Hamburg", container_count: "3", gross_weight_kg: "71240" };
const EXAMPLE_BL: FieldValues = { ...EXAMPLE_SI, consignee: "XYZ Trading Co", port_of_loading: "SINGAPORE" };

const nonEmpty = (values: FieldValues): FieldValues => Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ""));

/** Type the values yourself and see how the engine judges them: case, punctuation and number formats, and a real difference. */
export function CustomValues() {
  const [si, setSi] = useState<FieldValues>(EXAMPLE_SI);
  const [bl, setBl] = useState<FieldValues>(EXAMPLE_BL);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<ComparisonOutcomeData | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const filled = Object.keys(nonEmpty(si)).length + Object.keys(nonEmpty(bl)).length;

  async function compare() {
    setLoading(true);
    setError(null);
    setOutcome(null);
    const siValues = nonEmpty(si);
    const blValues = nonEmpty(bl);
    const response = await postJson<ComparisonOutcomeData["comparison"]>("/features/comparison/api", { si: siValues, bl: blValues });
    setLoading(false);
    if (response.ok) setOutcome({ comparison: response.data, si: siValues, bl: blValues });
    else setError(response.error);
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5 p-6 sm:p-8">
        <div className="hidden grid-cols-[9rem_1fr_1fr] gap-4 font-mono text-[10px] uppercase tracking-widest text-fg-faint sm:grid">
          <span>Field</span>
          <span>SI (reference)</span>
          <span>Draft BL</span>
        </div>
        <div className="space-y-4">
          {COMPARED_FIELDS.map((field) => (
            <div key={field} className="grid gap-2 sm:grid-cols-[9rem_1fr_1fr] sm:items-center sm:gap-4">
              <span className="text-sm font-semibold">{fieldLabel(field)}</span>
              <input value={si[field] ?? ""} onChange={(e) => setSi({ ...si, [field]: e.target.value })} placeholder="SI value" aria-label={`SI ${fieldLabel(field)}`} className="field" />
              <input value={bl[field] ?? ""} onChange={(e) => setBl({ ...bl, [field]: e.target.value })} placeholder="BL value" aria-label={`BL ${fieldLabel(field)}`} className="field" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={compare} disabled={loading || filled === 0} className="btn btn-primary btn-shine !px-7 !py-3">
            <Icon name="play" size={16} />
            {loading ? "Comparing…" : "Compare these values"}
          </button>
          <button type="button" onClick={() => { setSi(EXAMPLE_SI); setBl(EXAMPLE_BL); setOutcome(null); }} className="btn btn-glass !py-3">
            <Icon name="sparkles" size={16} />
            Load the example
          </button>
          <button type="button" onClick={() => { setSi({}); setBl({}); setOutcome(null); }} className="btn btn-glass !py-3">
            Clear
          </button>
        </div>
        <p className="text-xs text-fg-faint">Try changing only capital letters or a comma: those are treated as formatting, not as a mismatch. Numbers are always compared exactly.</p>
      </div>

      {error && <ErrorNotice error={error} />}
      {outcome && <ComparisonOutcome data={outcome} />}
    </div>
  );
}
