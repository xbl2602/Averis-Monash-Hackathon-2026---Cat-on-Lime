/**
 * mail 模块的错误分类（api/params.ts 按类型映射 HTTP 状态码，见 PHASE2_SPEC 第 1 节）。
 */

/** 请求参数不合法（缺字段、格式不对、目标不存在）→ HTTP 400 */
export class MailRequestError extends Error {}

/** 目标资源不存在（比如要停用的项目 id 查无此行）→ HTTP 404；继承 MailRequestError 以复用上层 catch */
export class MailNotFoundError extends MailRequestError {}

/** 邮件相关数据表读不到/写不了（缺 Supabase service key、表未建、连接失败）→ HTTP 503 */
export class MailStoreUnavailableError extends Error {}

/** Supabase 调用返回错误（表结构不对、网络失败等）→ HTTP 500 */
export class MailDataError extends Error {}
