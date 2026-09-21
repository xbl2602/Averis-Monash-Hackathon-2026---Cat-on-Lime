import { makeReviewBulkPostHandler } from "@/lib/shared/review/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = makeReviewBulkPostHandler("classification");
