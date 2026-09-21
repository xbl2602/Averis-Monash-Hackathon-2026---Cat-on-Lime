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
  /** 稳定短代码：rate_limited / unauthorized / invalid_request / overloaded / timeout / network_error / invalid_response / http_error */
  code: string;
}

export class UpstreamServiceError extends Error {
  readonly provider: string;
  readonly status: number;
  readonly code: string;

  constructor(info: UpstreamServiceErrorInfo) {
    super(
      `上游服务（${info.provider}）返回 ${info.status}（${info.code}），请稍后重试；` +
        `若持续失败请检查该 provider 的 API key 是否有效`
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
 * （`lib/llm/index.ts` 的 `callLLM`）决定——2026-09-21 起超时会自动重试一次（见该文件）。
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
