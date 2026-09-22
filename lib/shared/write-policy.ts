/**
 * The single implementation of the write-operation token policy (shared by REST routes and
 * the MCP aggregation layer, independent of transport).
 *
 * Rules (consistent with section 1 of the phase-2 SPEC):
 * - ADMIN_TOKEN not configured -> reject every write operation (secure default: better to
 *   have the feature unavailable than to allow open writes), HTTP 403
 * - Request header x-admin-token matches the configured value -> allow
 * - Anything else (missing/wrong) -> HTTP 401
 *
 * Why not use real login: in this demo setting, reads are fully open and writes use a shared
 * token — this lets judges freely browse and run the demo while still preventing random
 * passersby from tampering with the data.
 */

export type WriteAccess =
  | { authorized: true }
  | { authorized: false; status: 401 | 403; message: string };

export function getWriteAccess(headers: Headers): WriteAccess {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return {
      authorized: false,
      status: 403,
      message:
        "Write operation rejected: the server has no ADMIN_TOKEN configured. Please configure an admin token in .env.local / Vercel (see .env.example) — this protects against configuration being changed arbitrarily",
    };
  }
  const provided = headers.get("x-admin-token");
  if (provided !== expected) {
    return {
      authorized: false,
      status: 401,
      message: "Incorrect write-operation token (the x-admin-token request header is missing or wrong)",
    };
  }
  return { authorized: true };
}
