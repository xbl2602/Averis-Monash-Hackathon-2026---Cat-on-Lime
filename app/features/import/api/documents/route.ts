/**
 * GET  /features/import/api/documents  Document pool list (read is open)
 *   ?review_status=pending|filed|skipped & detected_type=SI|BL|OTHER|UNKNOWN & limit= & offset=
 * PUT  /features/import/api/documents  Manual classification (x-admin-token write-protected)
 *   body: { id, detected_type: "SI"|"BL"|"OTHER", expected_updated_at? }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import {
  classifyUploadedDocument,
  listUploadedDocuments,
  normalizeClassifyRequest,
  normalizeDocumentListQuery,
} from "../../logic";
import { parseJsonText, searchParamsToRecord, toImportErrorResponse } from "../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = normalizeDocumentListQuery(searchParamsToRecord(new URL(request.url).searchParams));
    return NextResponse.json(await listUploadedDocuments(query));
  } catch (err) {
    return toImportErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = parseJsonText(await request.text());
    return NextResponse.json(await classifyUploadedDocument(normalizeClassifyRequest(body)));
  } catch (err) {
    return toImportErrorResponse(err);
  }
}
