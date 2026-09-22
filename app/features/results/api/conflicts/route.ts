import { NextRequest, NextResponse } from "next/server";
import { listConflicts, normalizeConflictQuery } from "../../logic";
import { searchParamsToRecord, toErrorResponse } from "../params";

/**
 * GET /features/results/api/conflicts
 * Conflicting file pairs: emails where SI/BL disagree (MISMATCH) or need manual confirmation
 * (NEEDS_REVIEW), with the extracted field values from both sides attached. Defaults to sorting by
 * number of differing fields, most to least.
 *   ?status=MISMATCH&q=email_06&limit=20
 * Numeric search (2026-09-21 P1-6, affects querying only, not the official submission):
 *   ?numeric_mode=fuzzy&tolerance=2          Fuzzy mode: numeric fields with a difference <= tolerance don't count as a conflict
 *   ?value_field=gross_weight_kg&value=12000 Search by value (can be combined with fuzzy: matches ≈12000, within tolerance)
 */
export async function GET(req: NextRequest) {
  try {
    const query = normalizeConflictQuery(searchParamsToRecord(req.nextUrl.searchParams));
    return NextResponse.json(await listConflicts(query));
  } catch (err) {
    return toErrorResponse(err);
  }
}
