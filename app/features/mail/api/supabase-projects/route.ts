/**
 * GET  /features/mail/api/supabase-projects  List projects (read endpoint is open; service_key only comes back masked)
 * POST /features/mail/api/supabase-projects  Create/update a project (write-protected)
 *
 * POST body: { id?, label, project_url, anon_key?, service_key? }
 * - Omitting id = create; passing it = update (upsert, no check-then-write)
 * - service_key is stored encrypted; if the request passes back a mask (containing ... or •••), it's treated as "unchanged" and skipped rather than overwritten
 * - Response: { project: SupabaseProjectView } (service_key is masked)
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
      { error: "Mail storage is unavailable: the server is missing a Supabase service key (see .env.example)" },
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
