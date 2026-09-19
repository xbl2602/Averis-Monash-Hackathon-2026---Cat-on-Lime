import { NextRequest, NextResponse } from "next/server";
import { exportResults, normalizeExportRequest } from "../../logic";
import { searchParamsToRecord, toErrorResponse } from "../params";

/**
 * GET /features/results/api/export
 * Save as：scope=results|conflicts|stats|submission × format=json|md|txt。
 * 返回带下载头的文件本体（文件名在 Content-Disposition，是否完整在 X-Export-Incomplete）。
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
        "X-Export-Generated-At": doc.generatedAt,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
