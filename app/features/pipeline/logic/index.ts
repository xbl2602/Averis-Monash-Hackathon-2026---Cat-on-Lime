/**
 * 批量入口（整箱流水线）的唯一实现：REST（api/）和 MCP（mcp/）都只调用这里。
 *
 * 编排全部交给 lib/shared 的公共能力，本模块只负责"请求 → 选邮件 → 增量跳过 →
 * 分块限量并发跑批 → 分批 upsert 结果 → 汇总响应"这条流程，不重复实现任何引擎逻辑：
 * - lib/shared/sample-inputs.ts       读样例邮件 + 解析附件
 * - lib/shared/pipeline.ts            单封/批量流水线、输入指纹、引擎版本
 * - lib/shared/verification-store.ts  结果表读写（upsert）
 *
 * 分块与 deadline（2026-09-20 性能/可靠性评审）：
 * - 每块大小 = 一个并发波次（max(1, concurrency)），块结束才检查 deadline，
 *   这样"在途块"的最坏时长有上界（不会再出现 10 封×4 次调用×20s 的失控块）
 * - 结果行攒到 FLUSH_EVERY 条就 upsert 一次；deadline 停止/全部结束时补 flush
 * - ran/remaining 统一按"实际完成数 processed"计算，deadline 截断时不谎报跑完（B1 修法）
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
  type VerificationResultRow,
} from "@/lib/shared/verification-store";
import { BatchRequestError, StoreUnavailableError } from "./errors";
import {
  ANONYMOUS_DRY_RUN_MAX_LIMIT,
  BATCH_DEADLINE_MS,
  BATCH_MAX_FAILURES,
  FLUSH_EVERY,
  type BatchFailure,
  type RunBatchRequest,
  type RunBatchSummary,
} from "./types";

export { normalizeBatchRequest } from "./params";
export { BatchRequestError, StoreUnavailableError } from "./errors";
export type { BatchFailure, RunBatchRequest, RunBatchSummary } from "./types";

export interface RunPipelineBatchOptions {
  /** 这次调用是不是匿名（未带 x-admin-token）；只影响 dry_run 预览的封顶与 remaining 口径 */
  anonymous?: boolean;
}

export async function runPipelineBatch(
  request: RunBatchRequest,
  options: RunPipelineBatchOptions = {}
): Promise<RunBatchSummary> {
  const startedAt = Date.now();

  // 要写库却没有 service key：在跑模型之前就拒绝，别白白烧调用额度
  if (!request.dryRun && !isSupabaseServiceAvailable()) {
    throw new StoreUnavailableError(
      "批量处理会写结果表，但当前环境缺少 SUPABASE_SERVICE_ROLE_KEY；只想算不写库请传 dry_run=true"
    );
  }

  const allIds = await listSampleEmailIds();
  validateRequestedIds(request.emailIds, allIds);
  const scope = request.emailIds ?? allIds;

  // 匿名 dry_run 只预览清单头部的固定前缀：先截 id 再解析，匿名请求不会把整箱都读一遍/跑一遍
  const anonymousPreview = options.anonymous === true && request.dryRun;
  const effectiveIds = anonymousPreview
    ? scope.slice(0, Math.min(request.limit, ANONYMOUS_DRY_RUN_MAX_LIMIT))
    : request.emailIds;

  const inputs = await loadSamplePipelineInputs(effectiveIds);
  const hashByEmail = new Map<string, string>();
  const { toRun, skipped } = await selectToRun(inputs, request, hashByEmail);

  // remaining 的"目标"：匿名预览 = 本次 scope 的清单规模；其余 = 增量筛选后的待跑总数
  const target = anonymousPreview ? scope.length : toRun.length;
  const batch = toRun.slice(0, request.limit);

  // 每块 = 一个并发波次，块结束后检查 deadline（30s），到了就不再取新块
  const chunkSize = Math.max(1, request.concurrency);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let wrote = 0;
  let pendingRows: VerificationResultRow[] = [];
  let deadlineReached = false;
  const failures: BatchFailure[] = [];

  for (let offset = 0; offset < batch.length; offset += chunkSize) {
    const chunk = batch.slice(offset, offset + chunkSize);
    const outcome = await runBatchPipeline(chunk, {
      concurrency: request.concurrency,
      textProvider: request.provider,
    });

    processed += outcome.succeeded.length + outcome.failed.length;
    succeeded += outcome.succeeded.length;
    failed += outcome.failed.length;
    appendFailures(failures, outcome.failed);

    if (!request.dryRun) {
      pendingRows.push(
        ...outcome.succeeded.map(({ input, outcome: pipelineOutcome }) =>
          buildSuccessRow(input, pipelineOutcome, inputHashOf(hashByEmail, input))
        ),
        ...outcome.failed.map(({ input, error }) =>
          buildFailureRow(input, error, inputHashOf(hashByEmail, input))
        )
      );
      if (pendingRows.length >= FLUSH_EVERY) {
        wrote += await flushPendingRows(pendingRows);
        pendingRows = [];
      }
    }

    if (Date.now() - startedAt >= BATCH_DEADLINE_MS) {
      deadlineReached = true;
      break;
    }
  }

  // deadline 停止或全部结束：把没落库的尾巴补上（dry_run 不写库）
  if (!request.dryRun && pendingRows.length > 0) {
    wrote += await flushPendingRows(pendingRows);
    pendingRows = [];
  }

  const stoppedByDeadline = deadlineReached && processed < target;

  return {
    total_emails: allIds.length,
    selected: inputs.length,
    skipped,
    ran: processed,
    succeeded,
    failed,
    wrote,
    remaining: Math.max(0, target - processed),
    stopped_by_deadline: stoppedByDeadline,
    dry_run: request.dryRun,
    logic_version: PIPELINE_LOGIC_VERSION,
    duration_ms: Date.now() - startedAt,
    failures,
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

/** 失败明细最多留 BATCH_MAX_FAILURES 条（其余看 failed 计数和结果表） */
function appendFailures(
  failures: BatchFailure[],
  failedRows: { input: PipelineEmailInput; error: unknown }[]
): void {
  for (const entry of failedRows) {
    if (failures.length >= BATCH_MAX_FAILURES) return;
    failures.push({
      email_id: entry.input.email.email_id,
      error: describeError(entry.error),
    });
  }
}

/** 一批结果行随块 upsert；返回实际写入行数（由调用方累计到 wrote） */
async function flushPendingRows(rows: VerificationResultRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await upsertVerificationRows(rows);
  return rows.length;
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
