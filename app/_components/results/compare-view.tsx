"use client";

import { useMemo, useState } from "react";
import { COMPARED_FIELDS } from "@/lib/shared/types";
import type { ExtractedDocumentEvidence, FieldValues } from "../../_lib/contracts";
import { fieldLabel } from "../../_lib/labels";
import { Icon } from "../icon";
import { EvidenceChip } from "./evidence-chip";
import { diffValues, type DiffPart } from "./text-diff";

interface Row {
  field: string;
  si: string | undefined;
  bl: string | undefined;
  differs: boolean;
}

function Parts({ parts, tone }: { parts: DiffPart[]; tone: "del" | "add" }) {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "diff" ? (
          <mark key={i} className={tone === "del" ? "diff-del" : "diff-add"}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/**
 * One side's value for one field.
 *
 * The SI/BL tag is shown at every width, not just on narrow screens. On a wide screen the only clue
 * used to be the header row far above, so two flagged rows side by side were easy to read wrong —
 * pairing this row's SI with the next row's SI and concluding the engine had flagged two identical
 * values. It also means a copy-paste of this table still says which value came from which document.
 */
function Cell({
  label,
  value,
  parts,
  tone,
  evidence,
  missing,
  alignEnd = false,
  divider = false,
}: {
  label: string;
  value: string | undefined;
  parts: DiffPart[] | null;
  tone: "del" | "add";
  evidence: ExtractedDocumentEvidence[keyof ExtractedDocumentEvidence] | undefined;
  missing: boolean;
  alignEnd?: boolean;
  divider?: boolean;
}) {
  return (
    <div className={`min-w-0 ${divider ? "sm:border-l sm:border-line sm:pl-5" : ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="shrink-0 rounded bg-sunken px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-fg-faint">
          {label}
        </span>
        {value === undefined ? (
          <span className={`text-sm ${missing ? "font-semibold text-warn" : "text-fg-faint"}`}>{missing ? "Missing" : "—"}</span>
        ) : (
          <>
            <span className="break-words text-sm">{parts ? <Parts parts={parts} tone={tone} /> : value}</span>
            <EvidenceChip evidence={evidence} alignEnd={alignEnd} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The SI and the BL side by side, field by field. Fields the engine flagged are tinted, shake once and
 * have the differing characters marked. Fields that agree stay tucked away until asked for.
 * `defectFields` is the engine's verdict; the character marks only help the eye find the difference.
 */
export function CompareView({
  si,
  bl,
  defectFields,
  siEvidence,
  blEvidence,
  siTitle = "SI (reference)",
  blTitle = "Draft BL",
}: {
  si: FieldValues | null;
  bl: FieldValues | null;
  defectFields: string[];
  siEvidence?: ExtractedDocumentEvidence | null;
  blEvidence?: ExtractedDocumentEvidence | null;
  siTitle?: string;
  blTitle?: string;
}) {
  const [showMatching, setShowMatching] = useState(false);

  const { flagged, matching } = useMemo(() => {
    const rows: Row[] = COMPARED_FIELDS.map((field) => ({
      field,
      si: si?.[field],
      bl: bl?.[field],
      differs: defectFields.includes(field),
    })).filter((row) => row.si !== undefined || row.bl !== undefined || row.differs);
    return { flagged: rows.filter((r) => r.differs), matching: rows.filter((r) => !r.differs) };
  }, [si, bl, defectFields]);

  if (!si && !bl) {
    return <p className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-fg-muted">No extracted fields are stored for this email yet.</p>;
  }

  const renderRow = (row: Row, index: number, isFlagged: boolean) => {
    const both = row.si !== undefined && row.bl !== undefined;
    const diff = isFlagged && both ? diffValues(row.si as string, row.bl as string) : null;
    return (
      <div
        key={row.field}
        style={{ "--i": index } as React.CSSProperties}
        className={`animate-rise stagger grid gap-2 border-t border-line px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-5 ${
          isFlagged ? "bg-bad-soft/60 first:border-t-0" : ""
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {isFlagged && <Icon name="alert" size={16} className="shrink-0 text-bad" />}
          {fieldLabel(row.field)}
        </div>
        <Cell label="SI" value={row.si} parts={diff?.left ?? null} tone="del" evidence={siEvidence?.[row.field as keyof ExtractedDocumentEvidence]} missing={isFlagged && row.si === undefined} />
        <Cell label="BL" value={row.bl} parts={diff?.right ?? null} tone="add" evidence={blEvidence?.[row.field as keyof ExtractedDocumentEvidence]} missing={isFlagged && row.bl === undefined} alignEnd divider />
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-solid/60">
      <div className="hidden grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] gap-5 bg-sunken px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-fg-faint sm:grid">
        <span>Field</span>
        <span>{siTitle}</span>
        <span>{blTitle}</span>
      </div>

      {flagged.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-4 text-sm font-medium text-ok">
          <Icon name="checkCircle" size={20} />
          Nothing differs between the two documents.
        </div>
      )}
      {flagged.map((row, i) => renderRow(row, i, true))}

      {matching.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowMatching((v) => !v)}
            aria-expanded={showMatching}
            className="flex w-full items-center justify-center gap-2 border-t border-line px-4 py-2.5 text-xs font-semibold text-fg-muted transition hover:bg-sunken hover:text-fg"
          >
            <Icon name={showMatching ? "chevronUp" : "chevronDown"} size={16} />
            {showMatching ? "Hide" : "Show"} {matching.length} matching {matching.length === 1 ? "field" : "fields"}
          </button>
          <div className="expand" data-open={showMatching}>
            <div>{matching.map((row, i) => renderRow(row, i, false))}</div>
          </div>
        </>
      )}
    </div>
  );
}
