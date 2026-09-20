/**
 * GET /features/mail/api/gmail
 * 读 Gmail 连接状态（读接口开放，不回 token）。从未连接时返回 status=disconnected 的默认值，不报错。
 * 真实的 OAuth 回调地址是 /features/mail/api/gmail/callback（本阶段未实现，见 connect 接口注释）。
 */
import { NextResponse } from "next/server";
import { getGmailConnection, isMailStoreAvailable } from "../../logic";
import { toErrorResponse } from "../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMailStoreAvailable()) {
    return NextResponse.json(
      { error: "邮件存储不可用：服务端缺少 Supabase service key（见 .env.example）" },
      { status: 503 }
    );
  }
  try {
    return NextResponse.json(await getGmailConnection());
  } catch (err) {
    return toErrorResponse(err);
  }
}
