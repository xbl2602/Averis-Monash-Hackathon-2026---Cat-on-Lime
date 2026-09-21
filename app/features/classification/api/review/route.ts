import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// 人工复核闭环（P1-1）：classification 的复核队列目前只覆盖"全模型失败降级"这一种情况——
// Jev 判定的"置信度<0.85"没有持久化到 verification_results，见 docs/TODO.md P1-1 的实现记录。
// GET 复核队列；POST 应用一个动作（需要 x-admin-token）。契约见 docs/REVIEW_SPEC.md。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// rerun 动作会跑一次完整流水线（可能调模型），给够时间
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("classification");
export const POST = makeReviewActionPostHandler("classification");
