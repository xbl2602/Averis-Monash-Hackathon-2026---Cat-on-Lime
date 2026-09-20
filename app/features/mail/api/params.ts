/** HTTP 传输层的小工具：请求体解析 + 错误 → HTTP 响应（参数格式校验在 logic 里） */
import { NextResponse } from "next/server";
import { CryptoConfigError } from "@/lib/shared/crypto";
import { MailDataError, MailRequestError, MailStoreUnavailableError } from "../logic";

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    const text = await request.text();
    body = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    throw new MailRequestError("请求体不是合法 JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MailRequestError("请求体必须是 JSON 对象");
  }
  return body as Record<string, unknown>;
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof MailRequestError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof MailStoreUnavailableError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof MailDataError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  // 缺 ENCRYPTION_MASTER_KEY 时 encryptSecret 抛这个：消息本身已经说明缺什么，可安全回显
  if (err instanceof CryptoConfigError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  console.error("[mail/api] 未预期错误", err);
  return NextResponse.json({ error: "mail 模块内部错误，请稍后重试" }, { status: 500 });
}
