import { makeReviewHistoryGetHandler } from "@/lib/shared/review/http";

// GET ?email_id=email_004 -> { email_id, actions: ReviewActionRow[] }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = makeReviewHistoryGetHandler("comparison");
