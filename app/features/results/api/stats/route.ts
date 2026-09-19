import { NextResponse } from "next/server";
import { getStats } from "../../logic";
import { toErrorResponse } from "../params";

/**
 * GET /features/results/api/stats
 * 统计汇总：total / processed / pending / failed / 分类分布 / 状态分布 / 差异字段频次。
 */
export async function GET() {
  try {
    return NextResponse.json(await getStats());
  } catch (err) {
    return toErrorResponse(err);
  }
}
