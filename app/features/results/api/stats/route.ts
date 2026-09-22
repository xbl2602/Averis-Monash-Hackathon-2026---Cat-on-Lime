import { NextResponse } from "next/server";
import { getStats } from "../../logic";
import { toErrorResponse } from "../params";

/**
 * GET /features/results/api/stats
 * Statistics summary: total / processed / pending / failed / category distribution / status distribution / defect field frequency.
 */
export async function GET() {
  try {
    return NextResponse.json(await getStats());
  } catch (err) {
    return toErrorResponse(err);
  }
}
