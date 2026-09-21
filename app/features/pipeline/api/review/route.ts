import { makeReviewActionPostHandler, makeReviewQueueGetHandler } from "@/lib/shared/review/http";

// 人工复核闭环（P1-1）：pipeline 的复核队列 = processing_status=failed 或 model_provider
// 含 degraded 的邮件（技术性失败/降级），主要动作是 rerun 重跑、defer 搁置（需要 x-admin-token）。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// rerun 会跑一次完整流水线（可能调模型），给够时间
export const maxDuration = 30;

export const GET = makeReviewQueueGetHandler("pipeline");
export const POST = makeReviewActionPostHandler("pipeline");
