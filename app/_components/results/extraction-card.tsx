import { COMPARED_FIELDS } from "@/lib/shared/types";
import { Icon } from "../icon";
import { Badge } from "./badges";
import { EvidenceChip } from "./evidence-chip";
import type { ExtractDocumentResult } from "../../_lib/contracts";
import { fieldLabel } from "../../_lib/labels";

const TYPE_NOTE: Record<string, string> = {
  OTHER: "This does not look like an SI or a BL (maybe an invoice or packing list).",
  UNKNOWN: "The document type could not be recognised.",
};

/** The seven shipment fields read from one document, each with the line it came from. Missing fields are shown, not hidden. */
export function ExtractionCard({ title, result, index = 0 }: { title: string; result: ExtractDocumentResult; index?: number }) {
  const found = COMPARED_FIELDS.filter((f) => result.fields[f] !== undefined).length;
  const note = TYPE_NOTE[result.document_type];

  return (
    <section style={{ "--i": index } as React.CSSProperties} className="card animate-rise stagger p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={result.document_type === "SI" || result.document_type === "BL" ? "info" : "warn"} icon="file">{result.document_type}</Badge>
          <Badge tone="muted" icon={result.extracted_by === "rules" ? "list" : "sparkles"}>{result.extracted_by === "rules" ? "Read by rules" : "Model helped"}</Badge>
        </div>
      </header>
      <p className="mt-1 text-xs text-fg-faint">
        {found} of {COMPARED_FIELDS.length} fields found
      </p>
      {note && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn-soft p-3 text-xs text-warn">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {note}
        </p>
      )}
      <dl className="mt-4 divide-y divide-line">
        {COMPARED_FIELDS.map((field) => {
          const value = result.fields[field];
          return (
            <div key={field} className="grid gap-1 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-xs font-semibold text-fg-muted">{fieldLabel(field)}</dt>
              <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {value === undefined ? <span className="text-fg-faint">Not found</span> : <span className="break-words font-medium">{value}</span>}
                {value !== undefined && <EvidenceChip evidence={result.evidence[field]} />}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
