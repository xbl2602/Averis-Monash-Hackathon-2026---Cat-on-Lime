import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// Manual review loop (P1-1): comparison is the core sign-off entry point for MISMATCH/NEEDS_REVIEW.
// GET returns the review queue (?include_ok/q/status/reason/review_state/limit/offset);
// POST applies an action (requires x-admin-token). See docs/REVIEW_SPEC.md and SHARED_INTERFACES.md for the field/action contract.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The rerun action runs the full pipeline once (may call a model), so allow enough time
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("comparison");
export const POST = makeReviewActionPostHandler("comparison");
