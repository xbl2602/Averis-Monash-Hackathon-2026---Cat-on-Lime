/**
 * 批量入口（整箱流水线）的类型与常量。
 *
 * 对外契约（POST /features/pipeline/api 与 MCP tool run_batch）写在
 * SHARED_INTERFACES.md「pipeline 模块（批量入口）」一节，两边改动要同步。
 */
import type { LLMProvider } from "@/lib/llm";

/** 一次最多跑几封（样例数据总共 520 封） */
export const BATCH_MAX_LIMIT = 520;
/** 不传 limit 时的默认值：控制单次耗时，大任务分批调用（响应里有 remaining） */
export const BATCH_DEFAULT_LIMIT = 50;
/** 同时最多处理几封（见 CLAUDE.md「高并发」的限量并发要求） */
export const BATCH_MAX_CONCURRENCY = 8;
export const BATCH_DEFAULT_CONCURRENCY = 4;
/** 响应里最多列几条失败明细（其余的看 failed 计数和结果表） */
export const BATCH_MAX_FAILURES = 20;

export interface RunBatchRequest {
  /** 只跑这几封；不传 = 全部样例邮件 */
  emailIds?: string[];
  limit: number;
  /** true = 忽略增量指纹强制重算 */
  force: boolean;
  /** true = 只算不写库（不需要 service key，适合云端预览） */
  dryRun: boolean;
  /** 抽取/分类兜底用的文本模型，默认 claude；不能用 jev */
  provider?: LLMProvider;
  concurrency: number;
}

export interface BatchFailure {
  email_id: string;
  error: string;
}

export interface RunBatchSummary {
  /** 样例邮件总数 */
  total_emails: number;
  /** 本次选中的邮件数（email_ids 过滤后） */
  selected: number;
  /** 因"内容没变 + 引擎版本没变"而跳过的数量 */
  skipped: number;
  /** 本次真正跑的数量（受 limit 限制） */
  ran: number;
  succeeded: number;
  failed: number;
  /** 写入结果表的行数（成功 + 失败；dry_run 时为 0） */
  wrote: number;
  /** 还有多少封没跑（大于 0 时再调一次，或调大 limit） */
  remaining: number;
  dry_run: boolean;
  logic_version: string;
  duration_ms: number;
  failures: BatchFailure[];
}
