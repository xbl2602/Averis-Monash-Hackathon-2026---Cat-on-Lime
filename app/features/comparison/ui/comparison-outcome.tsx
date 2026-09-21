import { CompareView } from "../../../_components/results/compare-view";
import { VerdictBanner } from "../../../_components/results/verdict-banner";
import type { ComparedField, ComparisonStatus, ExtractedDocumentEvidence, FieldValues, ReviewReason } from "../../../_lib/contracts";

export interface ComparisonOutcomeData {
  comparison: { status: ComparisonStatus; defect_fields: ComparedField[]; has_defect: boolean; review_reason: ReviewReason | null };
  si: FieldValues;
  bl: FieldValues;
  siEvidence?: ExtractedDocumentEvidence;
  blEvidence?: ExtractedDocumentEvidence;
}

/** The verdict and the side-by-side that backs it up. Shared by the "sample email" and "my own values" tabs. */
export function ComparisonOutcome({ data }: { data: ComparisonOutcomeData }) {
  return (
    <div className="space-y-5" aria-live="polite">
      <VerdictBanner status={data.comparison.status} defectFields={data.comparison.defect_fields} reason={data.comparison.review_reason} />
      <CompareView si={data.si} bl={data.bl} defectFields={data.comparison.defect_fields} siEvidence={data.siEvidence} blEvidence={data.blEvidence} />
    </div>
  );
}
