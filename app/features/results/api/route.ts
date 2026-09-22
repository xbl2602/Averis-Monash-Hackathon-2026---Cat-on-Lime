import { NextRequest, NextResponse } from "next/server";
import { listResults, normalizeResultQuery } from "../logic";
import { searchParamsToRecord, toErrorResponse } from "./params";

/**
 * GET /features/results/api
 * Query stored verification results as needed (including unprocessed emails), with support for
 * filtering/sorting/grouping/pagination.
 * See the "results module" section of SHARED_INTERFACES.md for parameters. Example:
 *   ?category=BL_COMPARISON&status=MISMATCH&sort_by=defect_count&order=desc&group_by=category
 */
export async function GET(req: NextRequest) {
  try {
    const query = normalizeResultQuery(searchParamsToRecord(req.nextUrl.searchParams));
    const result = await listResults(query);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
