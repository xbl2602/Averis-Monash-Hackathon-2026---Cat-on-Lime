/**
 * The single validation/normalization entry point for batch request parameters.
 * Both the HTTP layer (JSON body) and the MCP layer (typed parameters) go through here, instead of
 * each transport layer rewriting the rules.
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
    throw new BatchRequestError("The request body must be a JSON object");
  }
  const input = raw as RawBatchInput;

  const emailIds = toEmailIds(input.email_ids);
  const retryFailed = toBoolean(input.retry_failed, "retry_failed") ?? false;
  if (retryFailed && emailIds) {
    throw new BatchRequestError(
      "retry_failed cannot be used together with email_ids: the retry list is picked automatically by the server from the results table (emails that failed processing or were degraded)"
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
    throw new BatchRequestError(`email_ids can have at most ${BATCH_MAX_LIMIT} entries per call`);
  }
  return [...new Set(ids)];
}

function toProvider(value: unknown): LLMProvider | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isLLMProvider(value)) {
    throw new BatchRequestError(
      `provider not supported: ${String(value)} (allowed: claude / openai / deepseek / gemini / lmstudio)`
    );
  }
  if (value === "jev") {
    throw new BatchRequestError(
      "jev can only do structured judgments (classification/comparison), it cannot be used as the text fallback model in the batch pipeline — please use gemini or another text model instead"
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
  throw new BatchRequestError(`${label} must be true / false, got: ${String(value)}`);
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
    throw new BatchRequestError(`${label} must be an integer between ${min} and ${max}, got: ${String(value)}`);
  }
  return parsed;
}
