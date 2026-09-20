/**
 * import feature 的错误类型：api 层据此映射 HTTP 状态码（见 api/params.ts）。
 * 全部带可读中文信息，不用错误码字符串。
 */

/** 请求参数/内容不合法 → 400 */
export class ImportRequestError extends Error {}

/** 单请求合计超过 3MB 上限 → 413（提示前端分批上传） */
export class BatchTooLargeError extends Error {}

/** 文档 id 不存在 → 404 */
export class DocumentNotFoundError extends Error {}

/** 乐观锁冲突：记录被别处改过 → 409 */
export class DocumentConflictError extends Error {}

/** Supabase 连不上/写失败等存储层问题 → 503 */
export class DocumentStoreError extends Error {}
