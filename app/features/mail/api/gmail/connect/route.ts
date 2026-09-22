/**
 * POST /features/mail/api/gmail/connect
 * Initiate a Gmail connection (write-protected). Real OAuth isn't implemented at this stage; returns a not_implemented placeholder explanation + redirect_uri.
 *
 * Real path (PHASE2_SPEC 4.3): Google OAuth (scope gmail.readonly)
 * -> /features/mail/api/gmail/callback exchanges the authorization code for a token -> encryptSecret then writes to mail_accounts
 * -> scheduled/manual users.messages.list fetches emails -> reuses the classify/extract/compare pipeline -> results land in verification_results.
 * When the real callback is implemented, this file's POST should become a 302 redirect to Google's authorization page, storing state in mail_accounts.
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
