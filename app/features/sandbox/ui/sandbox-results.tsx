import { CategoryBadge, Badge } from "../../../_components/results/badges";
import { CompareView } from "../../../_components/results/compare-view";
import { ExtractionCard } from "../../../_components/results/extraction-card";
import { VerdictBanner } from "../../../_components/results/verdict-banner";
import type { SandboxResult } from "../../../_lib/contracts";

/** The three answers from one sandbox run, revealed top to bottom: verdict, side-by-side, then the detail behind it. */
export function SandboxResults({ result }: { result: SandboxResult }) {
  const { classification, extraction, comparison } = result;

  return (
    <div className="space-y-6" aria-live="polite">
      <VerdictBanner status={comparison.status} defectFields={comparison.defect_fields} reason={comparison.review_reason} />

      {classification && (
        <div className="card animate-rise stagger flex flex-wrap items-center gap-x-6 gap-y-3 p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint">The email is</div>
          <CategoryBadge category={classification.category} />
          {classification.confidence !== null && <Badge tone="info" icon="target">{Math.round(classification.confidence * 100)}% confident</Badge>}
          {classification.needs_review && <Badge tone="warn" icon="flag">Needs a person to check</Badge>}
        </div>
      )}

      <section className="animate-rise stagger space-y-3" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="text-lg font-bold">SI against BL</h2>
        <CompareView si={extraction.si.fields} bl={extraction.bl.fields} defectFields={comparison.defect_fields} siEvidence={extraction.si.evidence} blEvidence={extraction.bl.evidence} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ExtractionCard title="What was read from the SI" result={extraction.si} index={3} />
        <ExtractionCard title="What was read from the BL" result={extraction.bl} index={4} />
      </div>
    </div>
  );
}
