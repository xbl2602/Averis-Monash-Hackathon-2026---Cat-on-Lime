/**
 * POST /features/config/api/test  Tests an external connection (requires x-admin-token)
 * body: { target: "claude"|"openai"|"deepseek"|"gemini"|"typesafe"|"supabase"|"lmstudio" }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { testConnection, type TestTarget } from "../../logic/test-connection";

const TARGETS: TestTarget[] = ["claude", "openai", "deepseek", "gemini", "typesafe", "supabase", "lmstudio"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// test-connection has an internal abort at 15s/20s; the platform function duration must exceed that, otherwise it gets cut off by a 504 first
export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let target: unknown;
  try {
    const body = (await request.json()) as { target?: unknown };
    target = body.target;
  } catch {
    return NextResponse.json({ error: "Request body is not valid JSON" }, { status: 400 });
  }
  if (typeof target !== "string" || !TARGETS.includes(target as TestTarget)) {
    return NextResponse.json(
      { error: `Invalid target, must be one of: ${TARGETS.join(" / ")}` },
      { status: 400 }
    );
  }

  const result = await testConnection(target as TestTarget);
  return NextResponse.json(result);
}
