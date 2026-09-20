/**
 * Gmail 账户（mail_accounts 表）的读取与断开。
 *
 * 本阶段只做"连接状态占位"，不实现真实 OAuth。真实路径（PHASE2_SPEC 4.3）：
 *   Google OAuth 授权（scope gmail.readonly）→ /features/mail/api/gmail/callback 回调
 *   → 用授权码换 token、encryptSecret 加密后写 mail_accounts → 定时/手动调用
 *   Gmail API users.messages.list 拉邮件 → 复用 classification/extraction/comparison
 *   流水线 → 结果落 verification_results。
 *
 * token 列只用来算 has_access_token / has_refresh_token，永远不出现在响应里（SPEC 第 1 节）。
 */
import { MailDataError } from "./errors";
import { getMailDbClient } from "./store";

export type GmailConnectionStatus = "disconnected" | "pending" | "connected" | "error";

export interface GmailConnectionView {
  provider: "gmail";
  status: GmailConnectionStatus;
  email_address: string | null;
  scopes: string[] | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  has_access_token: boolean;
  has_refresh_token: boolean;
  updated_at: string | null;
}

/**
 * 本阶段只有一个 Gmail 账户：用固定 UUID 作为行标识，
 * 查询/断开都直接按 id 读写或 upsert，不需要"先查再插"（并发安全，见 CLAUDE.md）。
 */
export const GMAIL_ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";

const GMAIL_STATUSES: GmailConnectionStatus[] = ["disconnected", "pending", "connected", "error"];

/** 从未连接时的默认值：读接口据此正常回 status=disconnected，不报错 */
export function emptyGmailConnection(): GmailConnectionView {
  return {
    provider: "gmail",
    status: "disconnected",
    email_address: null,
    scopes: null,
    token_expires_at: null,
    last_synced_at: null,
    has_access_token: false,
    has_refresh_token: false,
    updated_at: null,
  };
}

export async function getGmailConnection(): Promise<GmailConnectionView> {
  const client = getMailDbClient();
  const { data, error } = await client
    .from("mail_accounts")
    .select(
      "status, email_address, scopes, token_expires_at, last_synced_at, access_token, refresh_token, updated_at"
    )
    .eq("id", GMAIL_ACCOUNT_ID)
    .maybeSingle();
  if (error) {
    throw new MailDataError(`读取 Gmail 连接状态失败：${error.message}（确认 mail_accounts 表已创建，见 PHASE2_SPEC 4.1）`);
  }
  if (!data) return emptyGmailConnection();

  const row = data as {
    status: string | null;
    email_address: string | null;
    scopes: string[] | null;
    token_expires_at: string | null;
    last_synced_at: string | null;
    access_token: string | null;
    refresh_token: string | null;
    updated_at: string | null;
  };
  return {
    provider: "gmail",
    status: normalizeGmailStatus(row.status),
    email_address: row.email_address,
    scopes: row.scopes,
    token_expires_at: row.token_expires_at,
    last_synced_at: row.last_synced_at,
    has_access_token: Boolean(row.access_token),
    has_refresh_token: Boolean(row.refresh_token),
    updated_at: row.updated_at,
  };
}

/** 断开：清空 token、status 置 disconnected；upsert 让"从未连接过"也能安全调用 */
export async function disconnectGmail(): Promise<GmailConnectionView> {
  const client = getMailDbClient();
  const { error } = await client.from("mail_accounts").upsert(
    {
      id: GMAIL_ACCOUNT_ID,
      provider: "gmail",
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new MailDataError(`断开 Gmail 失败：${error.message}`);
  return getGmailConnection();
}

export interface GmailConnectPlaceholder {
  status: "not_implemented";
  message: string;
  redirect_uri: string;
}

const GMAIL_CONNECT_REQUIREMENTS =
  "Gmail 真实接入尚未实现，目前只提供连接状态占位。要接上真实邮箱需要：① 在 Google Cloud Console 创建一个 OAuth client（类型选 Web application）；" +
  "② 启用 Gmail API 并申请只读权限 https://www.googleapis.com/auth/gmail.readonly；" +
  "③ 把下面这个 redirect_uri 原样填进 OAuth client 的「已获授权的重定向 URI」；" +
  "④ 服务端用授权码换取 token、加密存入 mail_accounts 后，才能定时拉取邮件并送进现有核验流水线。本阶段授权的浏览器跳转还没有实现。";

/** 发起连接的占位响应：说明真实接入需要什么，并把回调地址按当前请求的 origin 拼出来 */
export function buildGmailConnectPlaceholder(origin: string): GmailConnectPlaceholder {
  return {
    status: "not_implemented",
    message: GMAIL_CONNECT_REQUIREMENTS,
    redirect_uri: `${origin}/features/mail/api/gmail/callback`,
  };
}

/** MCP sync_gmail 的占位结果（MCP 没有浏览器 origin 概念，只解释未实现的原因和真实路径） */
export function buildGmailSyncPlaceholder(): { status: "not_implemented"; message: string } {
  return {
    status: "not_implemented",
    message:
      "Gmail 自动同步尚未实现：需要先完成 Gmail OAuth 授权（scope gmail.readonly）并把 token 加密存入 mail_accounts，" +
      "之后才能调用 Gmail API users.messages.list 拉取邮件、交给现有分类/抽取/比对流水线。本阶段可先用 GET /features/mail/api/gmail 查看连接状态",
  };
}

function normalizeGmailStatus(value: string | null): GmailConnectionStatus {
  return GMAIL_STATUSES.includes(value as GmailConnectionStatus)
    ? (value as GmailConnectionStatus)
    : "error";
}
