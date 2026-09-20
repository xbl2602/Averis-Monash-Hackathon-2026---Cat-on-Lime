/** 批量入口的两类可预期错误（对应 HTTP 400 / 503）。
 * 显式设置 name：MCP/请求错误映射按稳定 name 匹配（见 lib/shared/request-errors.ts），
 * 不 import feature 错误类也能识别它们。 */

export class BatchRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchRequestError";
  }
}

export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreUnavailableError";
  }
}
