/**
 * Small HTTP transport-layer utilities: query string -> raw values, errors -> HTTP responses.
 * Parameter validation itself lives in logic/params.ts (shared with MCP); this only handles the "transport format" conversion.
 */
import { NextResponse } from "next/server";
import { DataAccessError, ResultQueryError } from "../logic";

/** When a parameter of the same name appears more than once, merge into a comma-separated value (normalize treats it as an array) */
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
    // Can't connect to the database / environment variables not configured: this is "temporarily unavailable", not a parameter problem
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  console.error("[results/api] Unexpected error", err);
  return NextResponse.json({ error: "Internal error in the results service, please try again later" }, { status: 500 });
}
