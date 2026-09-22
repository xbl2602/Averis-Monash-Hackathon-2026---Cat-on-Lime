/** Small HTTP transport-layer utility: errors -> HTTP responses (parameter validation itself lives in logic/params.ts) */
import { NextResponse } from "next/server";
import { BatchRequestError, StoreUnavailableError } from "../logic/errors";

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof BatchRequestError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof StoreUnavailableError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error("[pipeline/api] Unexpected error", err);
  return NextResponse.json({ error: "Internal error in batch processing, please try again later" }, { status: 500 });
}
