import { NextRequest, NextResponse } from "next/server";
import { isLLMProvider, isTextProvider } from "@/lib/llm";
import { readSampleAttachmentParsed } from "@/lib/shared/sample-inputs";
import { toClientError } from "@/lib/shared/request-errors";
import { extractFields } from "../logic";

// POST { "attachment_path": "attachments/email_004_SI.txt", "documentType": "SI", "provider": "gemini" (optional) }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A single-document request makes at most 1 external call (20s timeout) plus local parsing; 30s is enough and surfaces problems faster
export const maxDuration = 30;

const PROVIDER_HINT = "claude | openai | deepseek | gemini | lmstudio (jev not supported)";

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
  const body = raw as { attachment_path?: unknown; documentType?: unknown; provider?: unknown };

  if (typeof body.attachment_path !== "string" || body.attachment_path.trim() === "") {
    return NextResponse.json(
      { error: "The attachment_path parameter is required (a relative attachment path in the sample data, non-empty string)" },
      { status: 400 }
    );
  }
  if (body.documentType !== "SI" && body.documentType !== "BL") {
    return NextResponse.json(
      { error: 'documentType must be "SI" or "BL"' },
      { status: 400 }
    );
  }

  // null / "" for provider is treated as not passed (same convention as pipeline parameter validation); an explicit value must be a text model
  const rawProvider = body.provider;
  const provider =
    rawProvider === undefined || rawProvider === null || rawProvider === "" ? undefined : rawProvider;
  if (provider !== undefined) {
    if (!isLLMProvider(provider)) {
      return NextResponse.json(
        { error: `Unsupported provider: ${String(provider)} (choose from ${PROVIDER_HINT})` },
        { status: 400 }
      );
    }
    if (!isTextProvider(provider)) {
      return NextResponse.json(
        {
          error:
            "jev can only make structured judgments (classification/comparison), not text extraction — use a text model like gemini instead",
        },
        { status: 400 }
      );
    }
  }

  try {
    const parsed = await readSampleAttachmentParsed(body.attachment_path);
    if (parsed.status !== "ok") {
      // The parser's raw error only goes into server-side logs, never back to the caller (the error message is readable but never passes through the raw upstream/internal text)
      console.warn(
        `[extraction] Attachment ${body.attachment_path} failed to parse (raw details are server-side log only): ${parsed.error ?? "unknown reason"}`
      );
      return NextResponse.json(
        { error: `Attachment ${body.attachment_path} has no extractable text (may be a scanned image or a corrupted file), cannot extract fields` },
        { status: 422 }
      );
    }
    const result = await extractFields({
      documentText: parsed.text,
      documentType: body.documentType,
      provider,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** When a browser/tool opens this address directly, return usage instructions for the endpoint (no processing performed) */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/extraction/api",
    method: "POST",
    description:
      "Extracts 7 fields from an SI/BL document (shipper/consignee/notify_party/port_of_loading/port_of_discharge/container_count/gross_weight_kg); rules first, falling back to a text LLM only for missing fields",
    body: {
      attachment_path: 'The relative attachment path in the sample data, e.g. "attachments/email_004_SI.txt"',
      documentType: 'Required: "SI" or "BL"',
      provider: `Optional text fallback model, defaults to gemini; ${PROVIDER_HINT}`,
    },
    example: { attachment_path: "attachments/email_004_SI.txt", documentType: "SI" },
  });
}
