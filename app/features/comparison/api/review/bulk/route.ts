import { makeReviewBulkPostHandler } from "@/lib/shared/review/http";

// POST { email_ids[], action: "confirm"|"disposition"|"defer", payload? }（需要 x-admin-token）
// 逐条独立处理，失败隔离：返回 { batch_id, succeeded[], failed[] }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = makeReviewBulkPostHandler("comparison");
