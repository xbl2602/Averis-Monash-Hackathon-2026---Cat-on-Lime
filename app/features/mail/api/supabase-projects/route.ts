/**
 * GET  /features/mail/api/supabase-projects  列出项目（读接口开放；service_key 只回掩码）
 * POST /features/mail/api/supabase-projects  新增/更新项目（写保护）
 *
 * POST body: { id?, label, project_url, anon_key?, service_key? }
 * - id 不传 = 新增；传了 = 更新（upsert，不先查后写）
 * - service_key 加密存储；请求里传回掩码（含 … 或 •••）时视为"没改"，跳过不覆盖
 * - 响应：{ project: SupabaseProjectView }（service_key 是掩码）
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import {
  isMailStoreAvailable,
  listSupabaseProjects,
  normalizeSaveProjectInput,
  saveSupabaseProject,
} from "../../logic";
import { parseJsonBody, toErrorResponse } from "../params";

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
    return NextResponse.json({ items: await listSupabaseProjects() });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await parseJsonBody(request);
    const project = await saveSupabaseProject(normalizeSaveProjectInput(body));
    return NextResponse.json({ project });
  } catch (err) {
    return toErrorResponse(err);
  }
}
