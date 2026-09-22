/**
 * "Numeric comparison mode" for conflict search (2026-09-21 P1-6, see DECISION_LOG decision 28).
 *
 * Serves only the "query/filter" layer, with two capabilities:
 * (1) Fuzzy mode (numeric_mode=fuzzy): numeric fields whose two-sided difference is within tolerance
 *     don't count as a conflict (absorbs conversion/rounding residuals);
 * (2) Search by value (value_field + value): find conflict pairs where either the SI or BL side equals
 *     (exact) or approximately equals (fuzzy + tolerance) the input value.
 *
 * Important boundary: the official submission path always stays an exact comparison (handled by the
 * comparison module, no tolerance — the official defect-injection weight differences are +-500~2000kg,
 * so tolerance would do more harm than good; see docs/FINALS_ROADMAP.md 3.5/4.4 for the rationale).
 * This file contains pure functions and never touches the database; conflicts.ts applies it after
 * fetching rows.
 */
import { NUMERIC_SEARCH_FIELDS, type ConflictPair, type ConflictQuery, type NumericSearchField } from "./types";

export function usesNumericFeatures(query: ConflictQuery): boolean {
  return query.numericMode === "fuzzy" || query.valueField !== null;
}

/**
 * Process one conflict pair according to the query mode; returning null means this pair "no longer
 * counts as a conflict" under fuzzy mode (and is dropped from the results).
 * Only does two things: "remove numeric defect fields" and "filter by value"; every other field is
 * copied from the stored value as-is, without changing status semantics.
 */
export function applyNumericQuery(pair: ConflictPair, query: ConflictQuery): ConflictPair | null {
  let defectFields = pair.defect_fields;

  if (query.numericMode === "fuzzy") {
    defectFields = defectFields.filter(
      (field) =>
        !(
          isNumericField(field) &&
          withinTolerance(field, pair.si_values[field], pair.bl_values[field], query.tolerance)
        )
    );
    // If absorbing small residuals leaves no other defects: MISMATCH is no longer a conflict; NEEDS_REVIEW stays as-is (uncertain != different)
    if (pair.status === "MISMATCH" && defectFields.length === 0) return null;
  }

  if (query.valueField !== null && query.value !== null) {
    const target = Number(query.value);
    const tolerance =
      query.numericMode === "fuzzy"
        ? toleranceFor(query.valueField, null, null, query.tolerance)
        : 0;
    if (!eitherSideMatches(pair, query.valueField, target, tolerance)) return null;
  }

  if (defectFields === pair.defect_fields) return pair;
  return { ...pair, defect_fields: defectFields, defect_count: defectFields.length };
}

export function isNumericField(field: string): field is NumericSearchField {
  return (NUMERIC_SEARCH_FIELDS as readonly string[]).includes(field);
}

/** Extract the number from a field: for weight, take the first number (decimals included); for container count, take the leading number ("3 x 40'GP" -> 3) */
export function parseFieldNumber(
  field: NumericSearchField,
  value: string | undefined
): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "");
  if (field === "gross_weight_kg") {
    const match = cleaned.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  const match = cleaned.match(/^\D*(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Tolerance: use the user-supplied value if given; otherwise use the default (weight max(0.5kg, 0.1%), container count 0) */
export function toleranceFor(
  field: NumericSearchField,
  a: number | null,
  b: number | null,
  userTolerance: number | null
): number {
  if (userTolerance !== null) return userTolerance;
  if (field === "gross_weight_kg") {
    const basis = Math.max(a ?? 0, b ?? 0);
    return Math.max(0.5, basis * 0.001);
  }
  return 0;
}

function withinTolerance(
  field: NumericSearchField,
  siValue: string | undefined,
  blValue: string | undefined,
  userTolerance: number | null
): boolean {
  const a = parseFieldNumber(field, siValue);
  const b = parseFieldNumber(field, blValue);
  if (a === null || b === null) return false; // If it can't be parsed, don't absorb it — keep the original verdict
  return Math.abs(a - b) <= toleranceFor(field, a, b, userTolerance) + Number.EPSILON;
}

function eitherSideMatches(
  pair: ConflictPair,
  field: NumericSearchField,
  target: number,
  tolerance: number
): boolean {
  for (const value of [pair.si_values[field], pair.bl_values[field]]) {
    const parsed = parseFieldNumber(field, value);
    if (parsed !== null && Math.abs(parsed - target) <= tolerance + Number.EPSILON) return true;
  }
  return false;
}
