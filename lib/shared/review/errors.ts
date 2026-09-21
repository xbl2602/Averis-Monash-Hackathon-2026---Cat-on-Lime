/**
 * 复核闭环的可读错误类型（REST/MCP 据此映射状态码；见 lib/shared/request-errors.ts）。
 * 命名和其余 feature 的 errors.ts 同一套习惯：构造时显式设置 this.name，
 * 让 request-errors.ts 能按稳定的 err.name 匹配，不用 import 这个文件。
 */
export class ReviewRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewRequestError";
  }
}

export class ReviewNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewNotFoundError";
  }
}

export class ReviewConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewConflictError";
  }
}

export class ReviewStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewStoreUnavailableError";
  }
}
