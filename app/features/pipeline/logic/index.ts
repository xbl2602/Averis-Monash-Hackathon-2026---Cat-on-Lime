/**
 * 批量入口（整箱流水线）的唯一实现：REST（api/）和 MCP（mcp/）都只调用这里。
 *
 * 编排全部交给 lib/shared 的公共能力，本模块只负责"请求 → 选邮件 → 增量跳过 →
 * 限量并发跑批 → upsert 结果 → 汇总响应"这条流程，不重复实现任何引擎逻辑：
 * - lib/shared/sample-inputs.ts       读样例邮件 + 解析附件
 * - lib/shared/pipeline.ts            单封/批量流水线、输入指纹、引擎版本
 * - lib/shared/verification-store.ts  结果表读写（upsert）
 */
import {
  PIPELINE_LOGIC_VERSION,
  computeInputHash,
  runBatchPipeline,
  type PipelineEmailInput,
} from "@/lib/shared/pipeline";
import { listSampleEmailIds, loadSamplePipelineInputs } from "@/lib/shared/sample-inputs";
import { isSupabaseServiceAvailable } from "@/lib/shared/supabase";
import {
  buildFailureRow,
  buildSuccessRow,
  describeError,
  loadStoredVerificationRows,
  upsertVerificationRows,
} from "@/lib/shared/verification-store";
import { BatchRequestError, StoreUnavailableError } from "./errors";
import { BATCH_MAX_FAILURES, type RunBatchRequest, type RunBatchSummary } from "./types";

export { normalizeBatchRequest } from "./params";
export { BatchRequestError, StoreUnavailableError } from "./errors";
export type { BatchFailure, RunBatchRequest, RunBatchSummary } from "./types";

export async function runPipelineBatch(request: RunBatchRequest): Promise<RunBatchSummary> {
  const startedAt = Date.now();

  // 要写库却没有 service key：在跑模型之前就拒绝，别白白烧调用额度
  if (!request.dryRun && !isSupabaseServiceAvailable()) {
    throw new StoreUnavailableError(
      "批量处理会写结果表，但当前环境缺少 SUPABASE_SERVICE_ROLE_KEY；只想算不写库请传 dry_run=true"
    );
  }

  const allIds = await listSampleEmailIds();
  validateRequestedIds(request.emailIds, allIds);

  const inputs = await loadSamplePipelineInputs(request.emailIds);
  const hashByEmail = new Map<string, string>();
  const { toRun, skipped } = await selectToRun(inputs, request, hashByEmail);

  const batch = toRun.slice(0, request.limit);
  const remaining = toRun.length - batch.length;

  const outcome = await runBatchPipeline(batch, {
    concurrency: request.concurrency,
    textProvider: request.provider,
  });

  let wrote = 0;
  if (!request.dryRun) {
    const rows = [
      ...outcome.succeeded.map(({ input, outcome: pipelineOutcome }) =>
        buildSuccessRow(input, pipelineOutcome, inputHashOf(hashByEmail, input))
      ),
      ...outcome.failed.map(({ input, error }) =>
        buildFailureRow(input, error, inputHashOf(hashByEmail, input))
      ),
    ];
    await upsertVerificationRows(rows);
    wrote = rows.length;
  }

  return {
    total_emails: allIds.length,
    selected: inputs.length,
    skipped,
    ran: batch.length,
    succeeded: outcome.succeeded.length,
    failed: outcome.failed.length,
    wrote,
    remaining,
    dry_run: request.dryRun,
    logic_version: PIPELINE_LOGIC_VERSION,
    duration_ms: Date.now() - startedAt,
    failures: outcome.failed.slice(0, BATCH_MAX_FAILURES).map(({ input, error }) => ({
      email_id: input.email.email_id,
      error: describeError(error),
    })),
  };
}

/**
 * 增量选择：内容指纹 + 引擎版本都没变、且上次是成功结果的邮件直接跳过。
 * dry_run / force 时不做增量（全部进本次待跑列表）。
 */
async function selectToRun(
  inputs: PipelineEmailInput[],
  request: RunBatchRequest,
  hashByEmail: Map<string, string>
): Promise<{ toRun: PipelineEmailInput[]; skipped: number }> {
  if (request.dryRun || request.force) {
    for (const input of inputs) {
      hashByEmail.set(input.email.email_id, computeInputHash(input));
    }
    return { toRun: inputs, skipped: 0 };
  }

  const stored = await loadStoredVerificationRows();
  const toRun: PipelineEmailInput[] = [];
  let skipped = 0;

  for (const input of inputs) {
    const hash = computeInputHash(input);
    const row = stored.get(input.email.email_id);
    const unchanged =
      row &&
      row.processing_status === "ok" &&
      row.input_hash === hash &&
      row.logic_version === PIPELINE_LOGIC_VERSION;

    if (unchanged) {
      skipped += 1;
      continue;
    }
    hashByEmail.set(input.email.email_id, hash);
    toRun.push(input);
  }
  return { toRun, skipped };
}

function validateRequestedIds(requested: string[] | undefined, allIds: string[]): void {
  if (!requested) return;
  const known = new Set(allIds);
  const unknown = requested.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new BatchRequestError(`样例数据里没有这些邮件：${unknown.join(" / ")}`);
  }
}

function inputHashOf(hashByEmail: Map<string, string>, input: PipelineEmailInput): string {
  const hash = hashByEmail.get(input.email.email_id);
  if (!hash) {
    throw new Error(`内部错误：邮件 ${input.email.email_id} 缺少输入指纹`);
  }
  return hash;
}
