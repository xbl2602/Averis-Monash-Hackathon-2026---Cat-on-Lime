import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// Manual review loop (P1-1): extraction's review queue = emails that are NEEDS_REVIEW with reason
// missing_value/wrong_doc_type/unreadable (extraction-related issues).
// GET the review queue; POST applies an action, commonly correct to fix extracted_si/extracted_bl (requires x-admin-token).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The rerun action runs the full pipeline once (may call a model), so allow enough time
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("extraction");
export const POST = makeReviewActionPostHandler("extraction");
