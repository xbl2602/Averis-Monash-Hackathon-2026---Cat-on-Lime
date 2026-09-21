import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// 人工复核闭环（P1-1）：comparison 是 MISMATCH/NEEDS_REVIEW 签字的核心入口。
// GET 返回复核队列（?include_ok/q/status/reason/review_state/limit/offset）；
// POST 应用一个动作（需要 x-admin-token）。字段/动作契约见 docs/REVIEW_SPEC.md、SHARED_INTERFACES.md。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// rerun 动作会跑一次完整流水线（可能调模型），给够时间
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("comparison");
export const POST = makeReviewActionPostHandler("comparison");
