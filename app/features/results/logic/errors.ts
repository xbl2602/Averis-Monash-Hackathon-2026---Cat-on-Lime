/**
 * results 模块的两类可预期错误：
 * - ResultQueryError：查询参数不合法（HTTP 400 / MCP 返回可读错误）
 * - DataAccessError：读取 Supabase 失败（HTTP 503）
 * 其余未预期错误由各传输层兜底成 500，不在这里吞掉。
 */

export class ResultQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultQueryError";
  }
}

export class DataAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataAccessError";
  }
}
