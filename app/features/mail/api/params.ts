/** Small HTTP transport-layer utilities: request body parsing + errors -> HTTP responses (parameter format validation lives in logic) */
import { NextResponse } from "next/server";
import { CryptoConfigError } from "@/lib/shared/crypto";
import { MailDataError, MailNotFoundError, MailRequestError, MailStoreUnavailableError } from "../logic";

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    const text = await request.text();
    body = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    throw new MailRequestError("The request body is not valid JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MailRequestError("The request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function toErrorResponse(err: unknown): NextResponse {
  // 404 must be checked before MailRequestError (NotFound is its subclass, otherwise it would get swallowed as a 400)
  if (err instanceof MailNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof MailRequestError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof MailStoreUnavailableError) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof MailDataError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  // encryptSecret throws this when ENCRYPTION_MASTER_KEY is missing: the message itself already explains what's missing, so it's safe to echo back
  if (err instanceof CryptoConfigError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  console.error("[mail/api] Unexpected error", err);
  return NextResponse.json({ error: "Internal error in the mail module, please try again later" }, { status: 500 });
}
