/**
 * 请求错误的统一映射（三个单文档 REST 路由 + MCP 汇总层共用）。
 *
 * 目标：给客户端"能看懂、但不泄露服务端/上游原文"的错误。
 * - 已知错误类（构造时就是可读中文）→ 原样返回
 * - LLMConfigError → 503（文案里说明了缺哪个环境变量）
 * - UpstreamServiceError → 429 / 502 / 504（message 只含 provider + 状态 + 稳定 code）
 * - 其余未知错误 → 500 固定文案，原始错误只进服务端日志
 *
 * 分层约束：这里**不 import 任何 feature 的错误类**，feature 错误按稳定的 err.name 匹配；
 * 因此各 feature 错误类必须在构造时显式设置 this.name（见 pipeline/import/mail 的 errors.ts）。
 */
import { LLMConfigError, UpstreamServiceError } from "@/lib/llm/errors";

export interface ClientError {
  status: number;
  message: string;
}

/** 已知可读错误类名 → HTTP 状态（与各 feature 自己的 api 映射保持一致） */
const KNOWN_ERROR_STATUS: Record<string, number> = {
  BatchRequestError: 400,
  StoreUnavailableError: 503,
  SampleDataPathError: 400,
  SampleNotFoundError: 404,
  ResultQueryError: 400,
  DataAccessError: 503,
  ImportRequestError: 400,
  BatchTooLargeError: 413,
  DocumentNotFoundError: 404,
  DocumentConflictError: 409,
  DocumentStoreError: 503,
  MailRequestError: 400,
  MailNotFoundError: 404,
  MailStoreUnavailableError: 503,
  MailDataError: 500,
  ReviewRequestError: 400,
  ReviewConsistencyError: 400,
  ReviewNotFoundError: 404,
  ReviewConflictError: 409,
  ReviewStoreUnavailableError: 503,
  SandboxRequestError: 400,
  SandboxFileTooLargeError: 413,
  FileValidationError: 400,
  DevModeRequestError: 400,
};

export const INTERNAL_ERROR_MESSAGE = "内部错误（详情见服务端日志）";

/** 把异常映射成给 HTTP 客户端的状态码 + 可读文案（REST 用） */
export function toClientError(err: unknown): ClientError {
  if (err instanceof LLMConfigError) {
    return { status: 503, message: err.message };
  }
  if (err instanceof UpstreamServiceError) {
    return { status: upstreamStatus(err), message: err.message };
  }
  if (err instanceof Error) {
    const status = KNOWN_ERROR_STATUS[err.name];
    if (status !== undefined) return { status, message: err.message };
    if (isNotFoundFsError(err)) {
      return { status: 404, message: "找不到对应的样例文件" };
    }
  }
  console.error("[request-errors] 未预期错误：", err);
  return { status: 500, message: INTERNAL_ERROR_MESSAGE };
}

/**
 * 让 MCP runTool 用同一套白名单决定"能不能把 message 回给调用方"。
 * 未知错误一律固定文案（原始 err 由调用方 console.error，不进响应）。
 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof LLMConfigError || err instanceof UpstreamServiceError) {
    return err.message;
  }
  if (err instanceof Error && KNOWN_ERROR_STATUS[err.name] !== undefined) {
    return err.message;
  }
  return INTERNAL_ERROR_MESSAGE;
}

function upstreamStatus(err: UpstreamServiceError): number {
  if (err.status === 429) return 429; // 限流：保留 429 语义，提示稍后重试
  if (err.status === 401 || err.status === 403) return 502; // 上游拒绝（key 可能无效）
  if (err.status === 504 || err.code === "timeout") return 504; // 超时
  return 502;
}

function isNotFoundFsError(err: Error): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}
