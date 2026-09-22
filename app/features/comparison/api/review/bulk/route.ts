import { makeReviewBulkPostHandler } from "@/lib/shared/review/http";

// POST { email_ids[], action: "confirm"|"disposition"|"defer", payload? } (requires x-admin-token)
// Each item is processed independently with failure isolation: returns { batch_id, succeeded[], failed[] }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = makeReviewBulkPostHandler("comparison");
