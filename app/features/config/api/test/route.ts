/**
 * POST /features/config/api/test  测试一个外部连接（需要 x-admin-token）
 * body: { target: "claude"|"openai"|"deepseek"|"gemini"|"typesafe"|"supabase"|"lmstudio" }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { testConnection, type TestTarget } from "../../logic/test-connection";

const TARGETS: TestTarget[] = ["claude", "openai", "deepseek", "gemini", "typesafe", "supabase", "lmstudio"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// test-connection 内部有 15s/20s 的 abort；平台函数时长必须大于它，否则会先被 504 掐断
export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let target: unknown;
  try {
    const body = (await request.json()) as { target?: unknown };
    target = body.target;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  if (typeof target !== "string" || !TARGETS.includes(target as TestTarget)) {
    return NextResponse.json(
      { error: `target 不合法，可选：${TARGETS.join(" / ")}` },
      { status: 400 }
    );
  }

  const result = await testConnection(target as TestTarget);
  return NextResponse.json(result);
}
