import { makeReviewUndoPostHandler } from "@/lib/shared/review/http";

// POST { email_id, action_id?, expected_updated_at? } (requires x-admin-token)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = makeReviewUndoPostHandler("comparison");
