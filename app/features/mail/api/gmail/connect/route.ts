/**
 * POST /features/mail/api/gmail/connect
 * 发起 Gmail 连接（写保护）。本阶段不实现真实 OAuth，返回 not_implemented 占位说明 + redirect_uri。
 *
 * 真实路径（PHASE2_SPEC 4.3）：Google OAuth（scope gmail.readonly）
 * → /features/mail/api/gmail/callback 用授权码换 token → encryptSecret 后写 mail_accounts
 * → 定时/手动 users.messages.list 拉邮件 → 复用分类/抽取/比对流水线 → 结果落 verification_results。
 * 实现真实回调时，本文件的 POST 改成 302 跳转到 Google 授权页，并把 state 存进 mail_accounts。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { buildGmailConnectPlaceholder } from "../../../logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  const origin = new URL(request.url).origin;
  return NextResponse.json(buildGmailConnectPlaceholder(origin));
}
