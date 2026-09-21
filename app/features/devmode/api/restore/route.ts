/**
 * ⚠️ 开发者模式：POST /features/devmode/api/restore
 * 清空全部核验数据表，再从 data/sample/ 重新导入官方样例邮件+附件（raw_emails/
 * parsed_attachments）。这是"小按钮恢复成官方题库样子"的实现：恢复后数据库状态等价于
 * 刚跑完 `npm run import:data` 的样子——verification_results 是空的（还没跑分类/抽取/
 * 比对），需要之后手动跑一次批量流水线才会有结果，不在这个接口里顺带跑（避免悄悄消耗
 * LLM 调用额度）。
 *
 * 两道门槛：x-admin-token + 请求体 { "confirm": "RESTORE SAMPLE DATA" } 逐字匹配。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { toClientError } from "@/lib/shared/request-errors";
import {
  assertConfirmPhrase,
  DEVMODE_WARNING,
  RESTORE_CONFIRM_PHRASE,
  restoreToOfficialSample,
} from "../../logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 全量重新解析 520 封邮件的附件（并发 5），比一般请求慢，留够时间
export const maxDuration = 60;

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
    assertConfirmPhrase(body, RESTORE_CONFIRM_PHRASE);
    const result = await restoreToOfficialSample();
    return NextResponse.json({ warning: DEVMODE_WARNING, ...result });
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** 浏览器直接打开时给出用法说明，不执行任何操作 */
export async function GET() {
  return NextResponse.json({
    warning: DEVMODE_WARNING,
    endpoint: "/features/devmode/api/restore",
    method: "POST",
    description:
      "清空全部核验数据表，再从 data/sample/ 重新导入官方样例邮件+附件，恢复到刚导入、还没跑过流水线的状态。不可逆、耗时较长（要重新解析全部附件）。",
    headers: { "x-admin-token": "必填，和其它写操作一样" },
    body: { confirm: `必填，必须逐字等于 "${RESTORE_CONFIRM_PHRASE}"` },
  });
}
