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

/**
 * 匿名 dry_run 预览单次最多解析/处理多少封。
 * 匿名请求（未带 x-admin-token）的 dry_run 只允许看清单头部固定前缀，
 * 防止匿名访客把整箱 520 封都解析+跑一遍（security/performance 评审）。
 */
export const ANONYMOUS_DRY_RUN_MAX_LIMIT = 20;

/**
 * 批量运行的软截止时间（毫秒）：**每处理完一块后**检查，到了就不再取新块。
 * 平台函数上限 60s，留余量给响应/写库；在途的那一块不受它约束（见 SHARED_INTERFACES）。
 */
export const BATCH_DEADLINE_MS = 30_000;

/**
 * 结果行最多在内存里攒多少条就 upsert 一次（!dryRun 时）。
 * 一起攒的目的是少写几次库；上限是为了"进程被平台杀掉时最多丢这么多行"。
 */
export const FLUSH_EVERY = 20;

export interface RunBatchRequest {
  /** 只跑这几封；不传 = 全部样例邮件（不能和 retryFailed 同时用） */
  emailIds?: string[];
  limit: number;
  /** true = 忽略增量指纹强制重算 */
  force: boolean;
  /** true = 只算不写库（不需要 service key，适合云端预览） */
  dryRun: boolean;
  /** 抽取/分类兜底用的文本模型，默认 gemini；不能用 jev */
  provider?: LLMProvider;
  concurrency: number;
  /**
   * 一键重试（2026-09-21 P0-2/P1-9）：true = 不传 email_ids，由服务端从结果表里
   * 自动挑出"处理失败（processing_status=failed）或降级（model_provider 带 degraded）"的邮件，
   * 强制重算。没有目标时本次 ran=0，正常返回。
   */
  retryFailed: boolean;
}

export interface BatchFailure {
  email_id: string;
  error: string;
}

export interface RunBatchSummary {
  /** 样例邮件总数 */
  total_emails: number;
  /** 本次选中的邮件数（email_ids 过滤后；匿名 dry_run = 实际解析数，≤20） */
  selected: number;
  /** 因"内容没变 + 引擎版本没变"而跳过的数量 */
  skipped: number;
  /** 本次真正完成的数量（成功 + 失败）——deadline 截断时小于待跑总数，不谎报 */
  ran: number;
  succeeded: number;
  failed: number;
  /** 写入结果表的行数（成功 + 失败；dry_run 时为 0） */
  wrote: number;
  /**
   * 还有多少封没跑 = 目标 − 已完成数。
   * 目标口径：匿名 dry_run 预览 = 本次 scope 的清单规模（scope = email_ids ?? 全部）；
   * 其余情况 = 增量筛选后本次待跑的总数（不受 limit 截断影响）。
   * 大于 0 时再调一次（写模式会自动跳过已算好的），或调大 limit。
   */
  remaining: number;
  /** true = 到了批量 deadline 且还有没跑完的目标（此时 remaining > 0） */
  stopped_by_deadline: boolean;
  dry_run: boolean;
  logic_version: string;
  duration_ms: number;
  failures: BatchFailure[];
}
