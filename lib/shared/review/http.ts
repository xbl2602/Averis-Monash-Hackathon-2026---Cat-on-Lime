/**
 * REST route factory for the human-review loop: each module's api/review/*.ts only needs to
 * call the factory functions here with its target target_kind, keeping itself "a very thin
 * layer" (see the logic/api/mcp/ui layering in CLAUDE.md).
 * All the business logic lives in lib/shared/review/actions.ts + store.ts; this file only
 * does "parse the request -> call -> wrap the response".
 *
 * Write token: consistent with pipeline/mail/import and the other modules, using the
 * x-admin-token request header (getWriteAccess).
 * A browser-only session for the review page's GUI (httpOnly cookie) isn't being built this
 * round — no GUI this round (see the implementation notes for P1-1 in docs/TODO.md).
 */
import { NextRequest, NextResponse } from "next/server";
import { isLLMProvider } from "@/lib/llm";
import { toClientError } from "@/lib/shared/request-errors";
import {
  COMPARED_FIELDS,
  COMPARISON_STATUSES,
  EMAIL_CATEGORIES,
  REVIEW_REASONS,
  type ComparedField,
  type ComparisonStatus,
  type EmailCategory,
  type ReviewReason,
} from "@/lib/shared/types";
import { getWriteAccess } from "@/lib/shared/write-policy";
import { applyReviewAction, bulkReviewAction, undoReviewAction } from "./actions";
import { ReviewRequestError } from "./errors";
import { getQueueItem, listActions, listReviewQueue } from "./store";
import {
  isReviewDisposition,
  REVIEW_ACTION_TYPES,
  type ApplyReviewActionRequest,
  type BulkReviewActionRequest,
  type ReviewActionType,
  type ReviewTargetKind,
  type UndoReviewActionRequest,
} from "./types";

function requireAdmin(req: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
  const access = getWriteAccess(req.headers);
  if (access.authorized) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json({ error: access.message }, { status: access.status }),
  };
}

function errorResponse(err: unknown): NextResponse {
  const { status, message } = toClientError(err);
  return NextResponse.json({ error: message }, { status });
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// ============================================================
// GET .../review: review queue
// ============================================================
export function makeReviewQueueGetHandler(targetKind: ReviewTargetKind) {
  return async function GET(req: NextRequest): Promise<NextResponse> {
    try {
      const sp = req.nextUrl.searchParams;
      const status = sp.get("status");
      const reason = sp.get("reason");
      const reviewState = sp.get("review_state");
      const { total, items } = await listReviewQueue(targetKind, {
        includeOk: sp.get("include_ok") === "true",
        q: sp.get("q") ?? undefined,
        status: status && (COMPARISON_STATUSES as readonly string[]).includes(status)
          ? (status as ComparisonStatus)
          : undefined,
        reason: reason && (REVIEW_REASONS as readonly string[]).includes(reason)
          ? (reason as ReviewReason)
          : undefined,
        reviewState: isReviewStateFilter(reviewState) ? reviewState : undefined,
        limit: parsePositiveInt(sp.get("limit"), 50),
        offset: parsePositiveInt(sp.get("offset"), 0),
      });
      return NextResponse.json({ total, items });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function isReviewStateFilter(
  value: string | null
): value is "confirmed" | "corrected" | "deferred" | "none" {
  return value === "confirmed" || value === "corrected" || value === "deferred" || value === "none";
}

// ============================================================
// GET .../review/history?email_id=: the action timeline for one item
// ============================================================
export function makeReviewHistoryGetHandler(targetKind: ReviewTargetKind) {
  return async function GET(req: NextRequest): Promise<NextResponse> {
    try {
      const emailId = req.nextUrl.searchParams.get("email_id");
      if (!emailId) {
        return NextResponse.json({ error: "Missing the email_id query parameter" }, { status: 400 });
      }
      const actions = await listActions(targetKind, emailId);
      return NextResponse.json({ email_id: emailId, actions });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

// ============================================================
// POST .../review: apply one action (requires the token)
// ============================================================
export function makeReviewActionPostHandler(targetKind: ReviewTargetKind) {
  return async function POST(req: NextRequest): Promise<NextResponse> {
    const admin = requireAdmin(req);
    if (!admin.ok) return admin.response;

    try {
      const body = await parseJsonObject(req);
      const request = parseApplyRequest(body);
      const result = await applyReviewAction(targetKind, request);
      return NextResponse.json(result);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

// ============================================================
// POST .../review/undo (requires the token)
// ============================================================
export function makeReviewUndoPostHandler(targetKind: ReviewTargetKind) {
  return async function POST(req: NextRequest): Promise<NextResponse> {
    const admin = requireAdmin(req);
    if (!admin.ok) return admin.response;

    try {
      const body = await parseJsonObject(req);
      const request = parseUndoRequest(body);
      const result = await undoReviewAction(targetKind, request);
      return NextResponse.json(result);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

// ============================================================
// POST .../review/bulk (requires the token)
// ============================================================
export function makeReviewBulkPostHandler(targetKind: ReviewTargetKind) {
  return async function POST(req: NextRequest): Promise<NextResponse> {
    const admin = requireAdmin(req);
    if (!admin.ok) return admin.response;

    try {
      const body = await parseJsonObject(req);
      const request = parseBulkRequest(body);
      const result = await bulkReviewAction(targetKind, request);
      return NextResponse.json(result);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

// ============================================================
// Request-body parsing + validation (REST and MCP each have their own independent zod validation; this is the REST side)
// ============================================================
async function parseJsonObject(req: NextRequest): Promise<Record<string, unknown>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ReviewRequestError("The request body isn't valid JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ReviewRequestError("The request body must be a JSON object");
  }
  return raw as Record<string, unknown>;
}

function parseApplyRequest(body: Record<string, unknown>): ApplyReviewActionRequest {
  const emailId = body.email_id;
  if (typeof emailId !== "string" || emailId.trim() === "") {
    throw new ReviewRequestError("Missing email_id (must be a non-empty string)");
  }
  const action = body.action;
  if (typeof action !== "string" || !(REVIEW_ACTION_TYPES as readonly string[]).includes(action)) {
    throw new ReviewRequestError(`action must be one of: ${REVIEW_ACTION_TYPES.join(" / ")}`);
  }
  return {
    email_id: emailId,
    action: action as ReviewActionType,
    payload: parsePayload(body.payload),
    note: typeof body.note === "string" ? body.note : undefined,
    reason: typeof body.reason === "string" ? body.reason : undefined,
    expected_updated_at: typeof body.expected_updated_at === "string" ? body.expected_updated_at : undefined,
  };
}

function parseUndoRequest(body: Record<string, unknown>): UndoReviewActionRequest {
  const emailId = body.email_id;
  if (typeof emailId !== "string" || emailId.trim() === "") {
    throw new ReviewRequestError("Missing email_id (must be a non-empty string)");
  }
  const actionId = body.action_id;
  if (actionId !== undefined && typeof actionId !== "number") {
    throw new ReviewRequestError("action_id must be a number");
  }
  return {
    email_id: emailId,
    action_id: actionId as number | undefined,
    expected_updated_at: typeof body.expected_updated_at === "string" ? body.expected_updated_at : undefined,
  };
}

function parseBulkRequest(body: Record<string, unknown>): BulkReviewActionRequest {
  const emailIds = body.email_ids;
  if (!Array.isArray(emailIds) || emailIds.length === 0 || !emailIds.every((id) => typeof id === "string")) {
    throw new ReviewRequestError("email_ids must be a non-empty array of strings");
  }
  const action = body.action;
  if (action !== "confirm" && action !== "disposition" && action !== "defer") {
    throw new ReviewRequestError("The action for a bulk operation can only be confirm / disposition / defer");
  }
  return {
    email_ids: emailIds,
    action,
    payload: parsePayload(body.payload),
  };
}

function parsePayload(raw: unknown): ApplyReviewActionRequest["payload"] {
  if (raw === undefined) return undefined;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ReviewRequestError("payload must be a JSON object");
  }
  const p = raw as Record<string, unknown>;
  const payload: NonNullable<ApplyReviewActionRequest["payload"]> = {};

  if (p.category !== undefined) {
    if (!(EMAIL_CATEGORIES as readonly string[]).includes(p.category as string)) {
      throw new ReviewRequestError(`Invalid payload.category: ${String(p.category)}`);
    }
    payload.category = p.category as EmailCategory;
  }
  if (p.comparison_status !== undefined) {
    if (!(COMPARISON_STATUSES as readonly string[]).includes(p.comparison_status as string)) {
      throw new ReviewRequestError(`Invalid payload.comparison_status: ${String(p.comparison_status)}`);
    }
    payload.comparison_status = p.comparison_status as ComparisonStatus;
  }
  if (p.review_reason !== undefined) {
    if (p.review_reason !== null && !(REVIEW_REASONS as readonly string[]).includes(p.review_reason as string)) {
      throw new ReviewRequestError(`Invalid payload.review_reason: ${String(p.review_reason)}`);
    }
    payload.review_reason = p.review_reason as ReviewReason | null;
  }
  if (p.defect_fields !== undefined) {
    if (
      !Array.isArray(p.defect_fields) ||
      !p.defect_fields.every((f) => (COMPARED_FIELDS as readonly string[]).includes(f))
    ) {
      throw new ReviewRequestError(`payload.defect_fields must be an array of valid field names: ${COMPARED_FIELDS.join(" / ")}`);
    }
    payload.defect_fields = p.defect_fields as ComparedField[];
  }
  if (p.extracted_si !== undefined) {
    payload.extracted_si = requirePlainStringRecord(p.extracted_si, "extracted_si");
  }
  if (p.extracted_bl !== undefined) {
    payload.extracted_bl = requirePlainStringRecord(p.extracted_bl, "extracted_bl");
  }
  if (p.disposition !== undefined) {
    if (!isReviewDisposition(p.disposition)) {
      throw new ReviewRequestError(`Invalid payload.disposition: ${String(p.disposition)}`);
    }
    payload.disposition = p.disposition;
  }
  if (p.provider !== undefined) {
    if (typeof p.provider !== "string" || !isLLMProvider(p.provider)) {
      throw new ReviewRequestError(`Invalid payload.provider: ${String(p.provider)}`);
    }
    payload.provider = p.provider;
  }
  return payload;
}

function requirePlainStringRecord(value: unknown, field: string): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ReviewRequestError(`payload.${field} must be an object`);
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== "string") {
      throw new ReviewRequestError(`Every value in payload.${field} must be a string`);
    }
  }
  return value as Record<string, string>;
}
