/**
 * ⚠️ 开发者模式：POST /features/devmode/api/wipe
 * 清空全部核验数据表（不动 app_config/mail_accounts/supabase_projects 这类连接配置）。
 * 不可逆——清完之后只能靠 /features/devmode/api/restore 或重新跑一次 npm run import:data
 * 找回样例数据，verification_results 里的人工复核记录会永久丢失，没有备份机制。
 *
 * 两道门槛：请求头 x-admin-token（和其它写操作一致）+ 请求体 { "confirm": "WIPE ALL DATA" }
 * 逐字匹配，两个都满足才会真的执行。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { toClientError } from "@/lib/shared/request-errors";
import { assertConfirmPhrase, DEVMODE_WARNING, WIPE_CONFIRM_PHRASE, wipeAllData } from "../../logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    assertConfirmPhrase(body, WIPE_CONFIRM_PHRASE);
    const wiped = await wipeAllData();
    return NextResponse.json({ warning: DEVMODE_WARNING, wiped });
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** 浏览器直接打开时给出用法说明，不执行任何操作 */
export async function GET() {
  return NextResponse.json({
    warning: DEVMODE_WARNING,
    endpoint: "/features/devmode/api/wipe",
    method: "POST",
    description: "清空全部核验数据表，不可逆。仅供开发者模式页面调用，不是正式产品功能。",
    headers: { "x-admin-token": "必填，和其它写操作一样" },
    body: { confirm: `必填，必须逐字等于 "${WIPE_CONFIRM_PHRASE}"` },
  });
}
