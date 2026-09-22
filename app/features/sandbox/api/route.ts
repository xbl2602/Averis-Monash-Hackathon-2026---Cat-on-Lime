import { NextRequest, NextResponse } from "next/server";
import { runAdhocTest } from "../logic";
import { toClientError } from "@/lib/shared/request-errors";

// POST { subject?, body?, from?, si: {name,data_base64}, bl: {name,data_base64}, provider? }
// -> { classification, extraction: {si,bl}, comparison }
// Writes to no database, needs no Supabase, needs no admin token — lets a judge ad-hoc test their own SI/BL document pair, see SHARED_INTERFACES.md "sandbox module"
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to 3 external calls (classification/SI extraction/BL extraction may each call a model once, plus one more for comparison), 30s leaves enough headroom
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body is not valid JSON" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  try {
    const result = await runAdhocTest(raw as Parameters<typeof runAdhocTest>[0]);
    return NextResponse.json(result);
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** When a browser/tool opens this address directly, return usage instructions for the endpoint (no processing performed) */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/sandbox/api",
    method: "POST",
    description:
      "Run classification (optional) + extraction + comparison once on your own SI + BL documents (not the repo's built-in samples). " +
      "Writes to no database, no Supabase configuration needed, and the result is discarded after use. Good for a judge swapping in a different document to test the system's real capability.",
    body: {
      subject: "Optional: email subject; classification only runs if given",
      body: "Optional: email body; classification only runs if given",
      from: "Optional: sender",
      si: 'Required: { name: "xxx.pdf", data_base64: "..." }, supports txt/md/pdf/docx/xlsx, single file no larger than 1.5MB',
      bl: "Required: same format as si",
      provider: "Optional: claude | openai | deepseek | gemini | lmstudio | jev; omit to match the default production engine (rules first, Gemini fallback only for missing fields, Jev for comparison review)",
    },
  });
}
