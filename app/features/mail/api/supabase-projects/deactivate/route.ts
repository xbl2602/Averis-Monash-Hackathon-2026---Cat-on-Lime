/**
 * POST /features/mail/api/supabase-projects/deactivate  Deactivate the active project (write-protected)
 * body: { id? }
 *
 * Purpose (an operability recovery channel): after activating a Supabase project with an unreachable
 * address/wrong credentials, every endpoint going through getSupabaseServiceClientAsync() will fail;
 * this endpoint handles "backing out":
 * - Passing id: only deactivates that project (if it doesn't exist -> readable 404 error)
 * - Omitting id: deactivates all currently is_active=true projects, falling back to the environment-variable configuration
 *
 * Concurrency convention (SPEC section 6): a conditional update (is_active=true [and id=...]), never read-then-write.
 * Response: { deactivated: number, items: [...] } (service_key is masked, consistent with the GET list).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { deactivateSupabaseProjects, normalizeDeactivateInput } from "../../../logic";
import { parseJsonBody, toErrorResponse } from "../../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await parseJsonBody(request);
    const result = await deactivateSupabaseProjects(normalizeDeactivateInput(body).id);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
