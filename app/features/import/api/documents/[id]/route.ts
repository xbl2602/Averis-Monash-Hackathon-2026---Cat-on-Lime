/**
 * GET /features/import/api/documents/[id]
 * Single document detail (read is open, includes the full extracted_text).
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
      throw new ImportRequestError(`"${id}" is not a valid document id (should be a uuid)`);
    }
    return NextResponse.json(await getUploadedDocument(id));
  } catch (err) {
    return toImportErrorResponse(err);
  }
}
