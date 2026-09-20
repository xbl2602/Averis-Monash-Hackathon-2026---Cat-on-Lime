import { NextRequest, NextResponse } from "next/server";
import { classifyEmail } from "../logic";
import { getSampleEmail } from "@/lib/shared/inbox";
import { isLLMProvider } from "@/lib/llm";
import { toClientError } from "@/lib/shared/request-errors";

// POST { "email_id": "email_004", "provider": "jev" } -> { category, confidence, needs_review }
// provider 可省略：不传时走混合引擎（规则 → Jev → Gemini 文本兜底）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 单文档请求最多 1 次外部调用（20s 超时）+ 本地读取，30s 足够且能更快暴露问题
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "请求体必须是一个 JSON 对象" }, { status: 400 });
  }
  const body = raw as { email_id?: unknown; provider?: unknown };

  if (typeof body.email_id !== "string" || body.email_id.trim() === "") {
    return NextResponse.json({ error: "缺少 email_id 参数（必须是非空字符串）" }, { status: 400 });
  }

  const provider = body.provider;
  if (provider !== undefined && !isLLMProvider(provider)) {
    return NextResponse.json(
      { error: `不支持的 provider：${String(provider)}` },
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

/** 浏览器/工具直接打开这个地址时，返回接口用法说明（不执行任何处理） */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/classification/api",
    method: "POST",
    description:
      "对一封样例邮件做分类（BL_COMPARISON / SI_REQUEST / INVOICE_QUERY / GENERAL / SPAM）。不传 provider 时走混合引擎：规则优先 → Jev → Gemini 文本兜底",
    body: {
      email_id: "样例数据里的邮件ID，例如 email_004",
      provider:
        "可选：claude | openai | deepseek | gemini | lmstudio | jev；不传 = 混合引擎（选 jev 会额外返回置信度）",
    },
    example: { email_id: "email_004" },
  });
}
