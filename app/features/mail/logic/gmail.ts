/**
 * Reading and disconnecting the Gmail account (mail_accounts table).
 *
 * This stage only implements a "connection status placeholder", not real OAuth. The real path (PHASE2_SPEC 4.3):
 *   Google OAuth authorization (scope gmail.readonly) -> /features/mail/api/gmail/callback callback
 *   -> exchange the authorization code for a token, encrypt it with encryptSecret and write to mail_accounts -> scheduled/manual call to
 *   the Gmail API users.messages.list to fetch emails -> reuse the classification/extraction/comparison
 *   pipeline -> results land in verification_results.
 *
 * The token columns are only used to compute has_access_token / has_refresh_token, and never appear in the response (SPEC section 1).
 */
import { MailDataError } from "./errors";
import { getMailDbClient } from "./store";

export type GmailConnectionStatus = "disconnected" | "pending" | "connected" | "error";

export interface GmailConnectionView {
  provider: "gmail";
  status: GmailConnectionStatus;
  email_address: string | null;
  scopes: string[] | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  has_access_token: boolean;
  has_refresh_token: boolean;
  updated_at: string | null;
}

/**
 * This stage only has one Gmail account: a fixed UUID is used as the row identifier,
 * and querying/disconnecting reads/writes or upserts directly by id, with no need for "check first, then insert" (concurrency-safe, see CLAUDE.md).
 */
export const GMAIL_ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";

const GMAIL_STATUSES: GmailConnectionStatus[] = ["disconnected", "pending", "connected", "error"];

/** Default value when never connected: the read endpoint returns status=disconnected normally based on this, without erroring */
export function emptyGmailConnection(): GmailConnectionView {
  return {
    provider: "gmail",
    status: "disconnected",
    email_address: null,
    scopes: null,
    token_expires_at: null,
    last_synced_at: null,
    has_access_token: false,
    has_refresh_token: false,
    updated_at: null,
  };
}

export async function getGmailConnection(): Promise<GmailConnectionView> {
  const client = getMailDbClient();
  const { data, error } = await client
    .from("mail_accounts")
    .select(
      "status, email_address, scopes, token_expires_at, last_synced_at, access_token, refresh_token, updated_at"
    )
    .eq("id", GMAIL_ACCOUNT_ID)
    .maybeSingle();
  if (error) {
    throw new MailDataError(`Failed to read Gmail connection status: ${error.message} (confirm the mail_accounts table has been created, see PHASE2_SPEC 4.1)`);
  }
  if (!data) return emptyGmailConnection();

  const row = data as {
    status: string | null;
    email_address: string | null;
    scopes: string[] | null;
    token_expires_at: string | null;
    last_synced_at: string | null;
    access_token: string | null;
    refresh_token: string | null;
    updated_at: string | null;
  };
  return {
    provider: "gmail",
    status: normalizeGmailStatus(row.status),
    email_address: row.email_address,
    scopes: row.scopes,
    token_expires_at: row.token_expires_at,
    last_synced_at: row.last_synced_at,
    has_access_token: Boolean(row.access_token),
    has_refresh_token: Boolean(row.refresh_token),
    updated_at: row.updated_at,
  };
}

/** Disconnect: clear the tokens and set status to disconnected; using upsert means it's safe to call even when "never connected before" */
export async function disconnectGmail(): Promise<GmailConnectionView> {
  const client = getMailDbClient();
  const { error } = await client.from("mail_accounts").upsert(
    {
      id: GMAIL_ACCOUNT_ID,
      provider: "gmail",
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new MailDataError(`Failed to disconnect Gmail: ${error.message}`);
  return getGmailConnection();
}

export interface GmailConnectPlaceholder {
  status: "not_implemented";
  message: string;
  redirect_uri: string;
}

const GMAIL_CONNECT_REQUIREMENTS =
  "Real Gmail integration isn't implemented yet — only a connection status placeholder is provided for now. Wiring up a real mailbox requires: (1) creating an OAuth client in Google Cloud Console (type: Web application); " +
  "(2) enabling the Gmail API and requesting the read-only scope https://www.googleapis.com/auth/gmail.readonly; " +
  "(3) entering the redirect_uri below verbatim into the OAuth client's \"Authorized redirect URIs\"; " +
  "(4) once the server exchanges the authorization code for a token and stores it encrypted in mail_accounts, it can then periodically fetch emails and feed them into the existing verification pipeline. The browser redirect for this stage's authorization isn't implemented yet.";

/** Placeholder response for initiating a connection: explains what real integration requires, and builds the callback address from the current request's origin */
export function buildGmailConnectPlaceholder(origin: string): GmailConnectPlaceholder {
  return {
    status: "not_implemented",
    message: GMAIL_CONNECT_REQUIREMENTS,
    redirect_uri: `${origin}/features/mail/api/gmail/callback`,
  };
}

/** Placeholder result for MCP sync_gmail (MCP has no concept of a browser origin, so this just explains why it isn't implemented and what the real path is) */
export function buildGmailSyncPlaceholder(): { status: "not_implemented"; message: string } {
  return {
    status: "not_implemented",
    message:
      "Automatic Gmail sync isn't implemented yet: Gmail OAuth authorization (scope gmail.readonly) needs to be completed first, with the token encrypted and stored in mail_accounts, " +
      "before the Gmail API's users.messages.list can be called to fetch emails and hand them to the existing classification/extraction/comparison pipeline. For now, use GET /features/mail/api/gmail to check connection status",
  };
}

function normalizeGmailStatus(value: string | null): GmailConnectionStatus {
  return GMAIL_STATUSES.includes(value as GmailConnectionStatus)
    ? (value as GmailConnectionStatus)
    : "error";
}
