/** HTTP 传输层的小工具：错误 → HTTP 响应（参数校验本身在 logic/params.ts） */
import { NextResponse } from "next/server";
import { BatchRequestError, StoreUnavailableError } from "../logic/errors";

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof BatchRequestError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof StoreUnavailableError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error("[pipeline/api] 未预期错误", err);
  return NextResponse.json({ error: "批量处理内部错误，请稍后重试" }, { status: 500 });
}
