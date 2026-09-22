/**
 * POST /features/import/api/upload
 * Manually upload a document (x-admin-token write-protected): extension whitelist -> magic bytes ->
 * size -> dedup -> parse -> detect from content -> original file into Storage -> metadata upserted
 * into uploaded_documents.
 * A single file's failure doesn't affect other files in the same batch; if the batch total exceeds
 * 3MB, returns 413 (the frontend splits into batches).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import {
  MAX_BATCH_BYTES,
  MAX_FILE_BYTES,
  MAX_RAW_BODY_BYTES,
  formatBytes,
  normalizeUploadRequest,
  uploadDocuments,
  BatchTooLargeError,
} from "../../logic";
import { parseJsonText, toImportErrorResponse } from "../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Parsing PDF/xlsx can be slow: Vercel Hobby functions cap out at 60s (no impact locally/in Docker)
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const rawBody = await request.text();
    const rawBytes = Buffer.byteLength(rawBody, "utf8");
    if (rawBytes > MAX_RAW_BODY_BYTES) {
      throw new BatchTooLargeError(
        `The request body is about ${formatBytes(rawBytes)}, exceeding the effective per-request cap of ${formatBytes(MAX_RAW_BODY_BYTES)}` +
          ` (base64 inflates file size); please split files into batches of roughly ${formatBytes(MAX_BATCH_BYTES)} and upload them separately`
      );
    }
    const body = parseJsonText(rawBody);
    const uploadRequest = normalizeUploadRequest(body);
    return NextResponse.json(await uploadDocuments(uploadRequest));
  } catch (err) {
    return toImportErrorResponse(err);
  }
}

/** When a browser opens this address directly, return the endpoint usage description (no processing is performed) */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/import/api/upload",
    method: "POST",
    description:
      "Manually upload a document (txt/md/pdf/docx/xlsx); validates by content and detects SI/BL/OTHER/UNKNOWN, stores the original file in Supabase Storage, and writes metadata to uploaded_documents.",
    headers: { "x-admin-token": "Write-operation token (server-side ADMIN_TOKEN)" },
    body: {
      files: "[{ name, mime?, data_base64 }], data_base64 is the base64 of the file content",
      batch_id: "Optional, echoed back as-is, so the frontend can match up a batch of results",
    },
    limits: {
      single_file: formatBytes(MAX_FILE_BYTES),
      per_request_total: `${formatBytes(MAX_BATCH_BYTES)} (returns 413 if exceeded, please split into batches)`,
    },
    response: {
      batch_id: "string",
      items: "[{ name, status: stored|duplicate|rejected, reason?, id?, detected_type? }]",
    },
  });
}
