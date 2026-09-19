import { NextRequest, NextResponse } from "next/server";
import { normalizeBatchRequest, runPipelineBatch } from "../logic";
import { BatchRequestError } from "../logic/errors";
import { toErrorResponse } from "./params";

/**
 * POST /features/pipeline/api
 * 触发整箱批量核验：样例邮件 → 分类/抽取/比对 → 按 email_id upsert 进 verification_results。
 * 请求体（JSON，全部可选；不传 = 全量增量跑，单次最多 50 封）：
 *   { email_ids: ["email_004"], limit: 20, force: false, dry_run: false,
 *     provider: "claude", concurrency: 4 }
 * 响应（RunBatchSummary）：selected / skipped / ran / succeeded / failed / wrote / remaining ...
 * 契约见 SHARED_INTERFACES.md「pipeline 模块（批量入口）」。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby 函数最长 60s：整箱靠 limit 分批调用（响应里的 remaining 提示还剩多少）
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);
    const request = normalizeBatchRequest(body);
    return NextResponse.json(await runPipelineBatch(request));
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** 浏览器/工具直接打开这个地址时，返回接口用法说明（不执行任何处理） */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/pipeline/api",
    method: "POST",
    description:
      "触发整箱批量核验（分类→抽取→比对→写结果表）。全量 520 封，增量跳过没变过的，单次最多跑 limit 封。",
    body: {
      email_ids: "string[]，只跑这几封；不传 = 全部样例邮件",
      limit: "1~520，默认 50（单次最多跑几封）",
      force: "boolean，默认 false；true = 忽略增量指纹强制重算",
      dry_run: "boolean，默认 false；true = 只算不写库（不需要 service key）",
      provider: "claude | openai | deepseek | gemini | lmstudio（文本兜底模型），默认 claude",
      concurrency: "1~8，默认 4（同时最多处理几封）",
    },
    example: {
      email_ids: ["email_004", "email_107"],
      limit: 10,
      dry_run: true,
    },
  });
}

async function parseJsonBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new BatchRequestError("请求体不是合法 JSON");
  }
}
