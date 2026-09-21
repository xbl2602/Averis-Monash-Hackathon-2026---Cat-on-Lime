import { NextRequest, NextResponse } from "next/server";
import { exportResults, normalizeExportRequest } from "../../logic";
import { searchParamsToRecord, toErrorResponse } from "../params";

/**
 * GET /features/results/api/export
 * Save as：scope=results|conflicts|stats|submission × format=json|md|txt。
 * 返回带下载头的文件本体；完整性信息都在响应头里（`<a>` 直接下载读不到，前端要用 fetch + blob）：
 *   X-Export-Scope / Format / Items / Incomplete / Expected-Source / Missing / Stale ...
 *   ?scope=conflicts&format=md
 *   ?scope=submission&format=json
 */
export async function GET(req: NextRequest) {
  try {
    const request = normalizeExportRequest(searchParamsToRecord(req.nextUrl.searchParams));
    const doc = await exportResults(request);

    return new NextResponse(doc.content, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${doc.filename}"`,
        "X-Export-Scope": doc.scope,
        "X-Export-Format": doc.format,
        "X-Export-Items": String(doc.itemCount),
        "X-Export-Incomplete": doc.incomplete ? "true" : "false",
        "X-Export-Expected-Source": doc.expectedSource ?? "",
        "X-Export-Missing": String(doc.missingIds.length),
        "X-Export-Missing-Ids": formatIdList(doc.missingIds),
        "X-Export-Stale": String(doc.staleIds.length),
        "X-Export-Stale-Ids": formatIdList(doc.staleIds),
        "X-Export-Invalid": String(doc.invalidIds.length),
        "X-Export-Invalid-Ids": formatIdList(doc.invalidIds),
        "X-Review-Pending": String(doc.reviewPending),
        "X-Review-Deferred": String(doc.reviewDeferred),
        "X-Export-Generated-At": doc.generatedAt,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** 头里最多列 20 个 email_id，其余用 (+N) 计数表示（避免头部过长） */
function formatIdList(ids: string[]): string {
  if (ids.length === 0) return "";
  const shown = ids.slice(0, 20).join(",");
  return ids.length <= 20 ? shown : `${shown},(+${ids.length - 20})`;
}
