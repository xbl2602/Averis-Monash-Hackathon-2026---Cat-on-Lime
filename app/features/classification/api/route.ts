import { NextRequest, NextResponse } from "next/server";
import { classifyEmail } from "../logic";
import { getSampleEmail } from "@/lib/shared/inbox";
import { isLLMProvider } from "@/lib/llm";
import { toClientError } from "@/lib/shared/request-errors";

// POST { "email_id": "email_004", "provider": "jev" } -> { category, confidence, needs_review }
// provider is optional: when omitted, uses the hybrid engine (rules → Jev → Gemini text fallback)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A single-document request makes at most 1 external call (20s timeout) plus a local read; 30s is enough and surfaces problems faster
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
  const body = raw as { email_id?: unknown; provider?: unknown };

  if (typeof body.email_id !== "string" || body.email_id.trim() === "") {
    return NextResponse.json({ error: "Missing email_id parameter (must be a non-empty string)" }, { status: 400 });
  }

  const provider = body.provider;
  if (provider !== undefined && !isLLMProvider(provider)) {
    return NextResponse.json(
      { error: `Unsupported provider: ${String(provider)}` },
      { status: 400 }
    );
  }

  try {
    const email = await getSampleEmail(body.email_id);
    const result = await classifyEmail({ email, provider });
    return NextResponse.json(result);
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** When a browser/tool opens this address directly, return usage instructions for the endpoint (no processing performed) */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/classification/api",
    method: "POST",
    description:
      "Classifies a sample email (BL_COMPARISON / SI_REQUEST / INVOICE_QUERY / GENERAL / SPAM). When provider is omitted, uses the hybrid engine: rules first → Jev → Gemini text fallback",
    body: {
      email_id: "The email ID in the sample data, e.g. email_004",
      provider:
        "Optional: claude | openai | deepseek | gemini | lmstudio | jev; omit for the hybrid engine (choosing jev also returns a confidence score)",
    },
    example: { email_id: "email_004" },
  });
}
