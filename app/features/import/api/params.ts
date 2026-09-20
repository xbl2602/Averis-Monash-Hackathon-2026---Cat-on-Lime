/**
 * import 模块 HTTP 传输层的小工具：JSON 解析、query string → 记录、错误 → 响应。
 * 参数校验本身在 logic/params.ts（REST/MCP 共用），这里只做"传输格式"的转换。
 */
import { NextResponse } from "next/server";
import {
  BatchTooLargeError,
  DocumentConflictError,
  DocumentNotFoundError,
  DocumentStoreError,
  ImportRequestError,
} from "../logic";

/** 同名参数出现多次时保留最后一个（本模块的参数都是单值） */
export function searchParamsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams) raw[key] = value;
  return raw;
}

export function parseJsonText(text: string): Record<string, unknown> {
  if (text.trim() === "") throw new ImportRequestError("请求体不能为空");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ImportRequestError("请求体不是合法 JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ImportRequestError("请求体必须是 JSON 对象");
  }
  return body as Record<string, unknown>;
}

export function toImportErrorResponse(err: unknown): NextResponse {
  if (err instanceof ImportRequestError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof BatchTooLargeError) {
    return NextResponse.json({ error: err.message }, { status: 413 });
  }
  if (err instanceof DocumentNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof DocumentConflictError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof DocumentStoreError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error("[import/api] 未预期错误", err);
  return NextResponse.json(
    { error: "import 服务内部错误，请稍后重试（详细原因已记录到服务端日志）" },
    { status: 500 }
  );
}
