import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// Manual review loop (P1-1): classification's review queue currently only covers the single case of
// "all-model failure fallback" — Jev's "confidence < 0.85" determination is not persisted to
// verification_results, see docs/TODO.md P1-1 for implementation notes.
// GET the review queue; POST applies an action (requires x-admin-token). See docs/REVIEW_SPEC.md for the contract.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The rerun action runs the full pipeline once (may call a model), so allow enough time
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("classification");
export const POST = makeReviewActionPostHandler("classification");
