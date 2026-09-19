/** 批量入口的两类可预期错误（对应 HTTP 400 / 503） */

export class BatchRequestError extends Error {}

export class StoreUnavailableError extends Error {}
