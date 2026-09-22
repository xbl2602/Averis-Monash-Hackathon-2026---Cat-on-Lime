/**
 * Parse the 7 fields out of SI/BL document text using "label rules" (no model call).
 * Covers every layout seen in the sample data (txt / xlsx / docx / text extracted from a
 * text-layer PDF):
 * - Label variants: Shipper/Exporter, Consignee / To the Order of (common on bills of lading),
 *   Notify Party, POL / Load Port / Port of Loading, POD / Discharge Port / Port of Discharge,
 *   Total Containers / No. of Containers or Packages, Gross Wt / Gross Weight / TOTAL Gross
 *   Weightnn
 * - Value position: sometimes on the same line as the label (txt/xlsx), sometimes a few lines
 *   below (docx/pdf)
 * - Placeholders (TBA / N/A / ____MT / empty) count as "field not present" and are left to the
 *   caller to flag as missing_value
 */
import type {
  ComparedField,
  ExtractedDocumentEvidence,
  ExtractedDocumentFields,
} from "@/lib/shared/types";

interface LabelDef {
  field: ComparedField;
  patterns: RegExp[];
}

const LABELS: LabelDef[] = [
  { field: "shipper", patterns: [/^shipper(?:\/exporter)?\b/] },
  { field: "consignee", patterns: [/^consignee\b/, /^to the order of\b/] },
  { field: "notify_party", patterns: [/^notify(?: party)?\b/] },
  {
    field: "port_of_loading",
    patterns: [/^port of loading\b/, /^pol\b/, /^load(?:ing)? port\b/],
  },
  {
    field: "port_of_discharge",
    patterns: [/^port of discharge\b/, /^pod\b/, /^discharge port\b/],
  },
  {
    field: "container_count",
    patterns: [
      /^container count\b/,
      /^total containers?\b/,
      /^no\. of containers?(?: or packages)?\b/,
      /^containers\b/,
    ],
  },
  // "Weightnn" is a print variant that shows up in the samples; \w* tolerates it
  { field: "gross_weight_kg", patterns: [/^(?:total\s+)?gross\s*(?:wt|weight)\w*/] },
];

// Stop words when collecting a value: stop as soon as a line "looks like the next section header"
const STOP_LINE =
  /^(shipper|consignee|notify|port of|pol\b|pod\b|load(?:ing)? port|discharge port|container|total containers?|no\. of containers?|gross\s*(?:wt|weight)|vessel|ocean vessel|voyage|commodity|description|kinds of packages|hs code|booking|freight|export carrier|bill of lading|b\/l|order no|oc no|net weight|invoice|seller|buyer|date|tel\b|contact|documentation|shipment|delivery|goods)/i;

// Placeholders/empty values: treat these as "nothing extracted" (triggers missing_value instead
// of being accepted as a value)
export const PLACEHOLDER_VALUE = /^[_\-\s.]*$|^(tba|n\/?a|null|—|-)$/i;

// Each field's value must pass validation before it's accepted (prevents a header row or an
// unrelated line from being taken as the value)
const VALUE_VALIDATORS: Partial<Record<ComparedField, (value: string) => boolean>> = {
  container_count: (value) => /^\d+(\s*x\s*.+)?$/i.test(value),
  gross_weight_kg: (value) => /^[\d,.\s]+\s*(kgs?|mts?)?\.?$/i.test(value),
};

export interface ParsedDocumentFields {
  fields: ExtractedDocumentFields;
  evidence: ExtractedDocumentEvidence;
}

export function parseDocumentFields(text: string): ExtractedDocumentFields {
  return parseDocumentFieldsWithEvidence(text).fields;
}

/**
 * Parsing with provenance (2026-09-21, P1-7): each field records the source line number and
 * the original line text it matched (when the value sits on the line after the label, this
 * records the line the value actually came from). Used for display/review only — it does not
 * affect the field value itself.
 */
export function parseDocumentFieldsWithEvidence(text: string): ParsedDocumentFields {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/g, ""));
  const found: ExtractedDocumentFields = {};
  const evidence: ExtractedDocumentEvidence = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const lower = line.normalize("NFKC").toLowerCase();

    for (const { field, patterns } of LABELS) {
      const hit = patterns.map((pattern) => lower.match(pattern)).find(Boolean);
      if (!hit) continue;

      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      let value = consumeLabel(line.slice(indent + hit[0].length));
      let evidenceLine = i + 1;
      let evidenceText = line.trim();

      if (!value) {
        const collected = collectFollowingLines(lines, i, field);
        if (collected) {
          value = collected.value;
          evidenceLine = collected.line;
          evidenceText = collected.text;
        }
      }

      const cleaned = value
        .replace(/\s+/g, " ")
        .replace(/^[\s:：;]+|[\s;]+$/g, "")
        .trim();
      const valid =
        Boolean(cleaned) &&
        !PLACEHOLDER_VALUE.test(cleaned) &&
        (VALUE_VALIDATORS[field]?.(cleaned) ?? true);
      if (valid) {
        found[field] = cleaned;
        evidence[field] = { line: evidenceLine, text: evidenceText, source: "rules" };
      }
      break; // only one field per line
    }
  }
  return { fields: found, evidence };
}

// Strip modifiers that sit right after the label (parenthetical notes, the "毛重(KGS)" gross-weight
// annotation, "/Intermediate Consignee" wording). NOTE: "毛重" (Chinese for "gross weight") is a
// literal string that appears in real document content and must not be translated/removed.
function consumeLabel(rest: string): string {
  let s = rest;
  for (let guard = 0; guard < 8; guard++) {
    const before = s;
    s = s.replace(/^\s*[\(（][^\)）]*[\)）]/, " ");
    s = s.replace(/^\s*毛重[^:：()]*/u, " ");
    s = s.replace(/^\s*\/?\s*intermediate consignee/i, " ");
    if (s === before) break;
  }
  return s.replace(/^[\s:：;]+/, "").trim();
}

// When the value is on the line after the label (common in docx/pdf): collect lines until the
// next section header/divider/blank line, up to a max.
// Returns the value along with the "first line the value actually came from" (line number +
// original text), used for field-level provenance.
interface CollectedValue {
  value: string;
  line: number;
  text: string;
}

function collectFollowingLines(
  lines: string[],
  labelIndex: number,
  field: ComparedField
): CollectedValue | null {
  const parts: string[] = [];
  let first: { line: number; text: string } | null = null;
  // Company names are usually on the first line, with the address on the following lines; only
  // take the first line so an address difference isn't mistaken for a company-name difference
  const maxLines = field === "shipper" || field === "consignee" || field === "notify_party" ? 1 : 3;

  for (let j = labelIndex + 1; j < lines.length; j++) {
    const next = lines[j];
    const nextLower = next.normalize("NFKC").toLowerCase();
    if (STOP_LINE.test(nextLower)) break;
    if (/^[=\-*#]{3,}/.test(next.trim())) break;
    if (!next.trim()) {
      if (parts.length) break;
      continue;
    }
    parts.push(next.trim());
    if (!first) first = { line: j + 1, text: next.trim() };
    if (parts.length >= maxLines) break;
  }
  if (!first) return null;
  return { value: parts.join(" "), line: first.line, text: first.text };
}

// Documents that are clearly not SI/BL (the wrong_doc_type traps in the samples: commercial
// invoice/packing list/certificate of origin).
// The implementation has moved to lib/shared/document-identify.ts: the import module uses the
// same rules when identifying uploaded documents; this re-export keeps existing callers
// (inside extraction) unchanged.
export { isLikelyOtherDocument } from "@/lib/shared/document-identify";
