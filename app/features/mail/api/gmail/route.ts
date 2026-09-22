/**
 * GET /features/mail/api/gmail
 * Read Gmail connection status (read endpoint is open, never returns the token). Returns the default status=disconnected when never connected, without erroring.
 * The real OAuth callback address is /features/mail/api/gmail/callback (not implemented at this stage, see the comment on the connect endpoint).
 */
import { NextResponse } from "next/server";
import { getGmailConnection, isMailStoreAvailable } from "../../logic";
import { toErrorResponse } from "../params";

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
    return NextResponse.json(await getGmailConnection());
  } catch (err) {
    return toErrorResponse(err);
  }
}
