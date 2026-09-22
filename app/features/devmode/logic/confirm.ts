import { DevModeRequestError } from "./errors";

/**
 * The second gate: x-admin-token alone isn't enough — the request body must also carry the exact
 * confirmation phrase character-for-character, to prevent scenarios like "the token is already
 * saved in some automation script/clipboard and gets triggered by accident."
 */
export function assertConfirmPhrase(body: unknown, expectedPhrase: string): void {
  const confirm = body !== null && typeof body === "object" ? (body as Record<string, unknown>).confirm : undefined;
  if (confirm !== expectedPhrase) {
    throw new DevModeRequestError(
      `This is a destructive operation and only runs if the request body includes { "confirm": "${expectedPhrase}" } (must match exactly) — no match was found`
    );
  }
}
