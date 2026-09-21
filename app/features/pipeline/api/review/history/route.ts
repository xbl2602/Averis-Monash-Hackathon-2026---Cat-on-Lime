import { makeReviewHistoryGetHandler } from "@/lib/shared/review/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = makeReviewHistoryGetHandler("pipeline");
