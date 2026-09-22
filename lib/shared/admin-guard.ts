/**
 * Unified write-operation token check (for REST routes).
 *
 * The policy itself has been pushed down into
 * [`lib/shared/write-policy.ts`](write-policy.ts) (transport-independent — REST and the MCP
 * aggregation layer share the same decision logic); this file only keeps the thin
 * "wrap a rejection as a NextResponse" layer, so existing call sites (config / mail / import /
 * pipeline) don't need to change.
 */
import { NextResponse } from "next/server";
import { getWriteAccess } from "./write-policy";

export function requireAdmin(request: Request): NextResponse | null {
  const access = getWriteAccess(request.headers);
  if (access.authorized) return null;
  return NextResponse.json({ error: access.message }, { status: access.status });
}
