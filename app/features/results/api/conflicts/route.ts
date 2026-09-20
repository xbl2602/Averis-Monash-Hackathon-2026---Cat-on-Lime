import { NextRequest, NextResponse } from "next/server";
import { listConflicts, normalizeConflictQuery } from "../../logic";
import { searchParamsToRecord, toErrorResponse } from "../params";

/**
 * GET /features/results/api/conflicts
 * 冲突文件对：SI/BL 不一致（MISMATCH）和需要人工确认（NEEDS_REVIEW）的邮件，
 * 附两边抽取到的字段值。默认按差异字段数从多到少。
 *   ?status=MISMATCH&q=email_06&limit=20
 * 数值搜索（2026-09-21 P1-6，只影响查询、不影响官方提交）：
 *   ?numeric_mode=fuzzy&tolerance=2          模糊口径：差值≤容差的数字字段不算冲突
 *   ?value_field=gross_weight_kg&value=12000 按值搜索（可叠加 fuzzy：≈12000，容差内命中）
 */
export async function GET(req: NextRequest) {
  try {
    const query = normalizeConflictQuery(searchParamsToRecord(req.nextUrl.searchParams));
    return NextResponse.json(await listConflicts(query));
  } catch (err) {
    return toErrorResponse(err);
  }
}
