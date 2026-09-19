import { NextRequest, NextResponse } from "next/server";
import { classifyEmail } from "../logic";
import { getSampleEmail } from "@/lib/shared/inbox";
import { isLLMProvider } from "@/lib/llm";

// POST { "email_id": "email_004", "provider": "jev" } -> { category, confidence, needs_review }
// provider 可省略，默认 claude
export async function POST(req: NextRequest) {
  let body: { email_id?: string; provider?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.email_id) {
    return NextResponse.json({ error: "缺少 email_id 参数" }, { status: 400 });
  }

  if (body.provider !== undefined && !isLLMProvider(body.provider)) {
    return NextResponse.json(
      { error: `不支持的 provider：${String(body.provider)}` },
      { status: 400 }
    );
  }

  try {
    const email = await getSampleEmail(body.email_id);
    const result = await classifyEmail({ email, provider: body.provider });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[classification/api] 分类失败", err);
    return NextResponse.json(
      { error: `找不到邮件 ${body.email_id} 或分类过程出错` },
      { status: 500 }
    );
  }
}
