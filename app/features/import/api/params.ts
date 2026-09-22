/**
 * Small HTTP transport-layer utilities for the import module: JSON parsing, query string -> record, errors -> responses.
 * Parameter validation itself lives in logic/params.ts (shared by REST/MCP); this only handles the "transport format" conversion.
 */
import { NextResponse } from "next/server";
import {
  BatchTooLargeError,
  DocumentConflictError,
  DocumentNotFoundError,
  DocumentStoreError,
  ImportRequestError,
} from "../logic";

/** When a parameter of the same name appears more than once, keep the last one (all of this module's parameters are single-valued) */
export function searchParamsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams) raw[key] = value;
  return raw;
}

export function parseJsonText(text: string): Record<string, unknown> {
  if (text.trim() === "") throw new ImportRequestError("The request body cannot be empty");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ImportRequestError("The request body is not valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ImportRequestError("The request body must be a JSON object");
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
  console.error("[import/api] Unexpected error", err);
  return NextResponse.json(
    { error: "Internal error in the import service, please try again later (details have been logged server-side)" },
    { status: 500 }
  );
}
