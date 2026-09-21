/**
 * sandbox feature 的错误类型：api 层据此映射 HTTP 状态码（见 lib/shared/request-errors.ts）。
 * 显式设置 name：请求错误映射按稳定 name 匹配，不用互相 import 错误类。
 */

/** 请求参数/文件内容不合法 → 400 */
export class SandboxRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxRequestError";
  }
}

/** 单文件超过大小上限 → 413 */
export class SandboxFileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxFileTooLargeError";
  }
}
