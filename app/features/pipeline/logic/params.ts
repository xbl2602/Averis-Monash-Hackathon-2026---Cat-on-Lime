/**
 * 批量请求参数的唯一校验/归一化入口。
 * HTTP 层（JSON body）和 MCP 层（typed 参数）都走这里，不在各自传输层重写规则。
 */
import { isLLMProvider, type LLMProvider } from "@/lib/llm";
import { BatchRequestError } from "./errors";
import {
  BATCH_DEFAULT_CONCURRENCY,
  BATCH_DEFAULT_LIMIT,
  BATCH_MAX_CONCURRENCY,
  BATCH_MAX_LIMIT,
  type RunBatchRequest,
} from "./types";

export interface RawBatchInput {
  email_ids?: unknown;
  limit?: unknown;
  force?: unknown;
  dry_run?: unknown;
  provider?: unknown;
  concurrency?: unknown;
  retry_failed?: unknown;
}

export function normalizeBatchRequest(raw: unknown): RunBatchRequest {
  if (raw === undefined || raw === null) raw = {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new BatchRequestError("请求体必须是一个 JSON 对象");
  }
  const input = raw as RawBatchInput;

  const emailIds = toEmailIds(input.email_ids);
  const retryFailed = toBoolean(input.retry_failed, "retry_failed") ?? false;
  if (retryFailed && emailIds) {
    throw new BatchRequestError(
      "retry_failed 不能和 email_ids 同时使用：重试名单由服务端从结果表里自动挑（处理失败或降级的邮件）"
    );
  }

  return {
    emailIds,
    limit: toInteger(input.limit, BATCH_DEFAULT_LIMIT, "limit", 1, BATCH_MAX_LIMIT),
    force: toBoolean(input.force, "force") ?? false,
    dryRun: toBoolean(input.dry_run, "dry_run") ?? false,
    provider: toProvider(input.provider),
    concurrency: toInteger(
      input.concurrency,
      BATCH_DEFAULT_CONCURRENCY,
      "concurrency",
      1,
      BATCH_MAX_CONCURRENCY
    ),
    retryFailed,
  };
}

function toEmailIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const ids = list
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter((item) => item !== "");
  if (ids.length === 0) return undefined;
  if (ids.length > BATCH_MAX_LIMIT) {
    throw new BatchRequestError(`email_ids 一次最多 ${BATCH_MAX_LIMIT} 个`);
  }
  return [...new Set(ids)];
}

function toProvider(value: unknown): LLMProvider | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isLLMProvider(value)) {
    throw new BatchRequestError(
      `provider 不支持：${String(value)}（可选 claude / openai / deepseek / gemini / lmstudio）`
    );
  }
  if (value === "jev") {
    throw new BatchRequestError(
      "jev 只能做结构化判断（分类/比对），不能当批量流程里的文本兜底模型，请换 gemini 等文本模型"
    );
  }
  return value;
}

function toBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const text = String(value).toLowerCase();
  if (text === "true" || text === "1") return true;
  if (text === "false" || text === "0") return false;
  throw new BatchRequestError(`${label} 只能是 true / false，收到：${String(value)}`);
}

function toInteger(
  value: unknown,
  fallback: number,
  label: string,
  min: number,
  max: number
): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BatchRequestError(`${label} 必须是 ${min}~${max} 之间的整数，收到：${String(value)}`);
  }
  return parsed;
}
