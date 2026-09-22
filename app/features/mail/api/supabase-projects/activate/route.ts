/**
 * POST /features/mail/api/supabase-projects/activate  Switch the active project (write-protected)
 * body: { id }
 *
 * Concurrency convention (SPEC section 6): never "read the current active project then change it" in
 * code — instead, directly (1) set other projects' is_active to false, (2) set the target to true;
 * the database's unique index supabase_projects_single_active guarantees at most one true at any given moment.
 * Response: { project: SupabaseProjectView } (service_key is masked).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { activateSupabaseProject, normalizeActivateInput } from "../../../logic";
import { parseJsonBody, toErrorResponse } from "../../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await parseJsonBody(request);
    const project = await activateSupabaseProject(normalizeActivateInput(body).id);
    return NextResponse.json({ project });
  } catch (err) {
    return toErrorResponse(err);
  }
}
