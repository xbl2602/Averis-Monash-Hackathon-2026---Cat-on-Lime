import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// 人工复核闭环（P1-1）：extraction 的复核队列 = NEEDS_REVIEW 且原因是
// missing_value/wrong_doc_type/unreadable 的邮件（抽取相关问题）。
// GET 复核队列；POST 应用一个动作，常用 correct 修正 extracted_si/extracted_bl（需要 x-admin-token）。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// rerun 动作会跑一次完整流水线（可能调模型），给够时间
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("extraction");
export const POST = makeReviewActionPostHandler("extraction");
