import { NextRequest, NextResponse } from "next/server";
import { listResults, normalizeResultQuery } from "../logic";
import { searchParamsToRecord, toErrorResponse } from "./params";

/**
 * GET /features/results/api
 * 按需求查询已存的核验结果（含未处理的邮件），支持筛选/排序/分组/分页。
 * 参数见 SHARED_INTERFACES.md「results 模块」。示例：
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
