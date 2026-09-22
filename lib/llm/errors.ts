/**
 * LLM 层的两类可读错误（REST/MCP 据此映射 503/429/502/504，不把上游原文传给客户端）。
 *
 * - LLMConfigError：本地没配 key / provider 在当前环境不可用（HTTP 503）。
 *   message 是自己构造的可读中文（含 provider 名和环境变量名），可以直接展示。
 * - UpstreamServiceError：上游服务返回错误或超时（HTTP 429/502/504）。
 *   message 固定为 provider + 状态 + 稳定 code 的模板；**严禁**把 SDK 错误原文、
 *   上游响应正文拼进 message——那些只允许进 console.warn（见 lib/llm/index.ts、jev.ts）。
 */

export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMConfigError";
  }
}

export interface UpstreamServiceErrorInfo {
  provider: string;
  /** 上游 HTTP 状态码；本地超时统一用 504 */
  status: number;
  /** 稳定短代码：rate_limited / unauthorized / payment_required / invalid_request / overloaded / upstream_error / timeout / network_error / invalid_response / http_error */
  code: string;
}

/**
 * 每类错误给一句"下一步该做什么"。固定模板，只按 code 选，绝不拼上游原文。
 * 2026-09-22：以前一律写"请稍后重试；若持续失败请检查 API key"——DeepSeek 余额不足返回 402 时，
 * 这句话会让人以为稍等就好，实际要去充值。
 */
const NEXT_STEP_BY_CODE: Record<string, string> = {
  payment_required: "账户余额不足或需要付费，请到该服务商后台充值后再试（重试不会成功）",
  unauthorized: "API key 无效或没有权限，请检查该 provider 的 key（重试不会成功）",
  invalid_request: "请求被上游拒绝（参数不合法），重试不会成功",
  rate_limited: "被限流了，请稍后重试或降低并发",
  timeout: "调用超时，请稍后重试或换一个模型",
};
const DEFAULT_NEXT_STEP = "请稍后重试；若持续失败请检查该 provider 的配置";

export class UpstreamServiceError extends Error {
  readonly provider: string;
  readonly status: number;
  readonly code: string;

  constructor(info: UpstreamServiceErrorInfo) {
    super(
      `上游服务（${info.provider}）返回 ${info.status}（${info.code}）：` +
        (NEXT_STEP_BY_CODE[info.code] ?? DEFAULT_NEXT_STEP)
    );
    this.name = "UpstreamServiceError";
    this.provider = info.provider;
    this.status = info.status;
    this.code = info.code;
  }
}

/**
 * 判断异常是不是"调用超时"。
 * AbortSignal.timeout 抛出的 DOMException 名字是 TimeoutError；不同 SDK 可能把它包进
 * cause 链，所以往 cause 里多找两层。这里只负责"判断是不是超时"，是否重试由调用方
 * （`lib/llm/index.ts` 的 `callLLM`）决定——2026-09-22 起超时**不再**原地重试，直接交给回退链换下一个。
 */
export function isTimeoutError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
    if (current.name === "TimeoutError" || current.name === "AbortError") return true;
    const code = (current as { code?: unknown }).code;
    if (code === "ETIMEDOUT" || code === "ABORT_ERR") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
