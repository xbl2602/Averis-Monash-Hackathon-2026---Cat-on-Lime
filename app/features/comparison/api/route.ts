import { NextRequest, NextResponse } from "next/server";
import { compareDocuments } from "../logic";
import type { ExtractedDocumentFields } from "@/lib/shared/types";
import { isLLMProvider } from "@/lib/llm";
import { toClientError } from "@/lib/shared/request-errors";

// POST { "si": {...}, "bl": {...}, "provider": "jev" } -> ComparisonResult
// provider is optional: when omitted, compares exactly character-by-character (no model call)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A single-document request makes at most 1 external call (20s timeout); 30s is enough and surfaces problems faster
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
  const body = raw as { si?: unknown; bl?: unknown; provider?: unknown };

  if (!isPlainObject(body.si) || !isPlainObject(body.bl)) {
    return NextResponse.json({ error: "Both si and bl field objects are required" }, { status: 400 });
  }

  const provider = body.provider;
  if (provider !== undefined && !isLLMProvider(provider)) {
    return NextResponse.json(
      { error: `Unsupported provider: ${String(provider)}` },
      { status: 400 }
    );
  }

  try {
    const result = await compareDocuments({
      si: body.si as ExtractedDocumentFields,
      bl: body.bl as ExtractedDocumentFields,
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
    endpoint: "/features/comparison/api",
    method: "POST",
    description:
      "Compares the extracted fields of SI and BL, returning OK/MISMATCH/NEEDS_REVIEW and the list of mismatched fields. When provider is omitted, compares exactly character-by-character (no model call)",
    body: {
      si: "The SI field object obtained from extraction (7 fields, all string values)",
      bl: "The BL field object obtained from extraction",
      provider: "Optional: claude | openai | deepseek | gemini | lmstudio | jev; choose jev to tolerate formatting differences",
    },
    example: {
      si: { shipper: "ACME SHIPPING CO., LTD." },
      bl: { shipper: "ACME SHIPPING CO.,LTD" },
      provider: "jev",
    },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
