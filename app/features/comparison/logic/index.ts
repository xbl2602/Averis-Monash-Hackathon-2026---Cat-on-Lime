/**
 * Comparison module:
 * - compareDocuments: a single entry point keyed by provider (for REST/MCP/UI use)
 * - compareDocumentsHybrid: the pipeline's default hybrid mode — normalize, then do an exact
 *   comparison first, and only hand candidate differences to Jev when "text fields don't match"
 *   (asked in one batch, noul judges "is this the same thing or not"); numeric fields are decided
 *   directly by code (Jev isn't good with numbers — testing showed it judges "5 x 20'GP" vs
 *   "6 x 20'GP" as the same).
 */
import { callJev, isJevAvailable, type JevQuestion, type LLMProvider } from "@/lib/llm";
import { callWithCache } from "@/lib/shared/llm-cache";
import {
  COMPARED_FIELDS,
  type ComparedField,
  type ExtractedDocumentFields,
  type ComparisonStatus,
  type ReviewReason,
} from "@/lib/shared/types";
import { canonicalFieldValue, NUMERIC_FIELDS } from "./canonical";

export interface CompareDocumentsInput {
  si: ExtractedDocumentFields;
  bl: ExtractedDocumentFields;
  /**
   * Which comparison method to use. Omit for exact character-by-character comparison (no model call;
   * the default is gemini, but this path never actually reaches a model — defaulting to gemini just
   * keeps the "default provider" convention consistent). Passing "jev" has Jev judge field-by-field
   * whether both sides refer to the same thing.
   */
  provider?: LLMProvider;
}

export interface CompareDocumentsResult {
  status: ComparisonStatus;
  defect_fields: ComparedField[];
  has_defect: boolean;
  review_reason: ReviewReason | null;
}

export interface HybridCompareResult extends CompareDocumentsResult {
  /**
   * rules = normalized exact comparison (including the conservative path when there's no Jev key);
   * rules+jev = candidate differences in text fields were reviewed by Jev;
   * rules-degraded = the Jev call failed; candidate differences were handled by the conservative
   *   rule (all counted as mismatches), retryable with one click
   */
  engine: "rules" | "rules+jev" | "rules-degraded";
}

// Jev returns, for each field, the probability that "both sides match"; below this value it counts as
// a mismatch (unified with classification's confidence threshold of 0.85, leaning conservative).
// Tested against the sample data: 0.85 still gives 0 false negatives and 0 false positives (the highest
// real mismatch scored 0.52, the lowest real match scored 0.88); going higher (0.9) starts producing
// false positives, so 0.85 is the ceiling — don't raise it casually. Rerun the threshold calibration
// before changing it (scripts/evaluate.ts + DECISION_LOG decision 22).
const JEV_MISMATCH_THRESHOLD = 0.85;

export async function compareDocuments(
  input: CompareDocumentsInput
): Promise<CompareDocumentsResult> {
  // The default only affects the "non-jev" branch (exact comparison, no model call); the jev branch is handled separately
  const provider = input.provider ?? "gemini";
  if (provider === "jev") {
    return compareWithJev(input.si, input.bl);
  }
  return compareByExactValue(input.si, input.bl);
}

/**
 * Hybrid comparison (used by the pipeline): normalize → exact comparison → hand text-field candidate
 * differences to Jev for review.
 * Degrades when there's no Jev key: text candidate differences are counted as mismatches directly
 * (leaning conservative, so nothing is missed).
 */
export async function compareDocumentsHybrid(input: {
  si: ExtractedDocumentFields;
  bl: ExtractedDocumentFields;
}): Promise<HybridCompareResult> {
  const { si, bl } = input;

  // One side has a value and the other doesn't: the normal flow would classify this as missing_value first; here it's defensively treated as a mismatch
  const oneSidedDefects = COMPARED_FIELDS.filter(
    (field) => hasValue(si[field]) !== hasValue(bl[field])
  );

  const bothPresent = COMPARED_FIELDS.filter(
    (field) => hasValue(si[field]) && hasValue(bl[field])
  );
  const candidates = bothPresent.filter(
    (field) => canonicalFieldValue(field, si[field]!) !== canonicalFieldValue(field, bl[field]!)
  );

  const numericDefects = candidates.filter((field) => NUMERIC_FIELDS.has(field));
  const textCandidates = candidates.filter((field) => !NUMERIC_FIELDS.has(field));

  if (textCandidates.length === 0 || !isJevAvailable()) {
    const defect_fields = dedupe([...oneSidedDefects, ...candidates]);
    return buildResult(defect_fields, "rules");
  }

  const state = buildFlatFieldPairs(textCandidates, si, bl);
  const questions: Record<string, JevQuestion> = {};
  for (const field of textCandidates) {
    questions[field] = {
      type: "noul",
      instructions: `Do the SI and BL refer to the same thing for ${field}? Tolerate differences in case, whitespace, punctuation, and word order; if the referenced object/place differs, they are not the same.`,
      criteria: { true: "Same meaning", false: "Different meaning or cannot confirm they match" },
    };
  }

  // A Jev review failure (network/quota/format anomaly) no longer fails the whole email
  // (2026-09-21 P1-5): conservatively degrade to "count every candidate difference as a mismatch"
  // (consistent with the no-Jev-key case, erring on the side of over-flagging), tag engine as
  // rules-degraded so it can be filtered for one-click retry, and log the failure reason server-side only.
  let jevDefects: ComparedField[];
  let engine: HybridCompareResult["engine"] = "rules+jev";
  try {
    const { value } = await callWithCache({
      purpose: "field_equivalence",
      provider: "jev",
      model: process.env.JEV_MODEL || "jev-latest",
      request: { state, questions },
      execute: () => callJev(state, questions),
    });

    jevDefects = textCandidates.filter((field) => {
      const answer = value.answers[field];
      if (!answer || answer.type !== "noul") {
        throw new Error(`Jev returned a malformed comparison result: field ${field} is missing a noul answer`);
      }
      return answer.noul < JEV_MISMATCH_THRESHOLD;
    });
  } catch (err) {
    console.warn(
      `[comparison] Jev review failed; candidate differences handled by the conservative rule (all counted as mismatches): ${err instanceof Error ? err.message : err}`
    );
    jevDefects = textCandidates;
    engine = "rules-degraded";
  }

  const defect_fields = dedupe([...oneSidedDefects, ...numericDefects, ...jevDefects]);
  return buildResult(defect_fields, engine);
}

function buildResult(
  defect_fields: ComparedField[],
  engine: HybridCompareResult["engine"]
): HybridCompareResult {
  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
    engine,
  };
}

function dedupe(fields: ComparedField[]): ComparedField[] {
  return [...new Set(fields)];
}

// Original logic: OK only if every field matches exactly (formatting differences would be misjudged as defects, which is why the Jev path exists)
function compareByExactValue(
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): CompareDocumentsResult {
  const defect_fields = COMPARED_FIELDS.filter(
    (field) => (si[field] ?? "") !== (bl[field] ?? "")
  );

  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
  };
}

// Uses Jev's noul (yes/no probability) to judge field by field, tolerating formatting differences without letting real mismatches slip through
async function compareWithJev(
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): Promise<CompareDocumentsResult> {
  const comparableFields = COMPARED_FIELDS.filter(
    (field) => hasValue(si[field]) || hasValue(bl[field])
  );

  // Neither side extracted any comparable fields — this can't be treated as "everything matches"; hand it to the caller
  if (comparableFields.length === 0) {
    return {
      status: "NEEDS_REVIEW",
      defect_fields: [],
      has_defect: false,
      review_reason: "missing_value",
    };
  }

  const questions: Record<string, JevQuestion> = {};
  for (const field of comparableFields) {
    questions[field] = {
      type: "noul",
      instructions: `Do the SI and BL refer to the same thing for ${field}?`,
      criteria: {
        true: "Identical, or differs only in formatting/case/whitespace while meaning the same thing",
        false: "Different meaning, or one side is missing and a match cannot be confirmed",
      },
    };
  }

  const state = buildFlatFieldPairs(comparableFields, si, bl);

  const { value } = await callWithCache({
    purpose: "field_equivalence",
    provider: "jev",
    model: process.env.JEV_MODEL || "jev-latest",
    request: { state, questions },
    execute: () => callJev(state, questions),
  });

  const defect_fields = comparableFields.filter((field) => {
    const answer = value.answers[field];
    if (!answer || answer.type !== "noul") {
      throw new Error(`Jev returned a malformed comparison result: field ${field} is missing a noul answer`);
    }
    return answer.noul < JEV_MISMATCH_THRESHOLD;
  });

  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
  };
}

/**
 * The flattened contract for model input (see docs/DECISION_SPEC.md §4.2/§6):
 * only a flat array of "field name + raw SI value + raw BL value" is sent to Jev;
 * never the whole document object, never the parsed text, never normalized values.
 */
interface FlatFieldPair {
  field: ComparedField;
  si_value: string | null;
  bl_value: string | null;
}

function buildFlatFieldPairs(
  fields: ComparedField[],
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): FlatFieldPair[] {
  return fields.map((field) => ({
    field,
    si_value: si[field] ?? null,
    bl_value: bl[field] ?? null,
  }));
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}
