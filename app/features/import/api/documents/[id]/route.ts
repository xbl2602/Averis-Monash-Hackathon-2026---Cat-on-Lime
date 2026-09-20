/**
 * GET /features/import/api/documents/[id]
 * 单个文档详情（读开放，含 extracted_text 全文）。
 */
import { NextResponse } from "next/server";
import { getUploadedDocument, isDocumentId, ImportRequestError } from "../../../logic";
import { toImportErrorResponse } from "../../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!isDocumentId(id)) {
      throw new ImportRequestError(`"${id}" 不是合法的文档 id（应为 uuid）`);
    }
    return NextResponse.json(await getUploadedDocument(id));
  } catch (err) {
    return toImportErrorResponse(err);
  }
}
