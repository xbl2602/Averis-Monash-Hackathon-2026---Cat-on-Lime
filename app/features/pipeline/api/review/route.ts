import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// Manual review loop (P1-1): the pipeline's review queue = emails with processing_status=failed or
// model_provider containing degraded (technical failure/degradation); the main actions are rerun and
// defer (requires x-admin-token).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// rerun runs a full pipeline pass (which may call a model), so give it plenty of time
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("pipeline");
export const POST = makeReviewActionPostHandler("pipeline");
