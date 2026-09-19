/**
 * HTTP 传输层的小工具：query string → 原始值、错误 → HTTP 响应。
 * 参数校验本身在 logic/params.ts（和 MCP 共用），这里只做"传输格式"的转换。
 */
import { NextResponse } from "next/server";
import { DataAccessError, ResultQueryError } from "../logic";

/** 同名参数出现多次时合并成逗号分隔（normalize 里按数组处理） */
export function searchParamsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    raw[key] = raw[key] ? `${raw[key]},${value}` : value;
  }
  return raw;
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ResultQueryError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof DataAccessError) {
    // 数据库连不上/没配环境变量：属于"暂时不可用"，不是参数问题
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error("[results/api] 未预期错误", err);
  return NextResponse.json({ error: "结果服务内部错误，请稍后重试" }, { status: 500 });
}
