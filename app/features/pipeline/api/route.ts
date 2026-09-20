import { NextRequest, NextResponse } from "next/server";
import { getWriteAccess } from "@/lib/shared/write-policy";
import { normalizeBatchRequest, runPipelineBatch } from "../logic";
import { BatchRequestError } from "../logic/errors";
import { toErrorResponse } from "./params";

/**
 * POST /features/pipeline/api
 * 触发整箱批量核验：样例邮件 → 分类/抽取/比对 → 按 email_id upsert 进 verification_results。
 * 请求体（JSON，全部可选；不传 = 全量增量跑，单次最多 50 封）：
 *   { email_ids: ["email_004"], limit: 20, force: false, dry_run: false,
 *     provider: "gemini", concurrency: 4 }
 * 写模式（dry_run=false）需要请求头 x-admin-token；匿名访客可用 dry_run=true 预览（单次封顶 20 封）。
 * 响应（RunBatchSummary）：selected / skipped / ran / succeeded / failed / wrote / remaining /
 * stopped_by_deadline ...（契约见 SHARED_INTERFACES.md「pipeline 模块（批量入口）」）
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby 函数最长 60s：整箱靠分块+30s deadline 分批调用（响应里的 remaining 提示还剩多少）
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);
    const request = normalizeBatchRequest(body);

    // 写模式：先校验口令（403 未配置 / 401 口令错）；匿名只允许 dry_run 预览
    const access = getWriteAccess(req.headers);
    if (!request.dryRun && !access.authorized) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    return NextResponse.json(
      await runPipelineBatch(request, { anonymous: !access.authorized })
    );
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
      "触发整箱批量核验（分类→抽取→比对→写结果表）。全量 520 封，增量跳过没变过的，单次最多跑 limit 封；" +
      "每块结束检查 30s deadline，到了就不再取新块（响应 stopped_by_deadline/remaining 会如实反映）。" +
      "写模式需要 x-admin-token；匿名可用 dry_run=true 预览（单次封顶 20 封，不写库）",
    headers: {
      "x-admin-token": "写模式（dry_run=false）必填；服务端未配置 ADMIN_TOKEN 时写操作一律拒绝",
    },
    body: {
      email_ids: "string[]，只跑这几封；不传 = 全部样例邮件",
      limit: "1~520，默认 50（单次最多跑几封；匿名 dry_run 再封顶 20）",
      force: "boolean，默认 false；true = 忽略增量指纹强制重算",
      dry_run:
        "boolean，默认 false；true = 只算不写库（不需要 service key；匿名=预览，单次最多 20 封）",
      provider: "claude | openai | deepseek | gemini | lmstudio（文本兜底模型），默认 gemini",
      concurrency: "1~8，默认 4（同时最多处理几封，也是一块的大小）",
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
