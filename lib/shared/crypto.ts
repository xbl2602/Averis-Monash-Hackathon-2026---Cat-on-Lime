/**
 * Encryption for sensitive fields (phase-2 SPEC section 2, scheme: AES-256-GCM).
 *
 * Why this design:
 * - Symmetric encryption: what's stored are API keys / OAuth tokens, and the server must be
 *   able to recover the plaintext to call third parties, which rules out hashing and
 *   asymmetric encryption
 * - GCM: encryption also produces an auth tag, so flipping even one bit of the ciphertext
 *   makes decryption fail (CBC doesn't offer this protection)
 * - Node's built-in crypto, zero dependencies; a 256-bit key has zero impact on cost
 * - The ciphertext carries a version prefix (v1.), so a future master-key rotation can write
 *   v2 going forward while still reading old v1 values, allowing a smooth migration
 *
 * The master key comes from the ENCRYPTION_MASTER_KEY environment variable (32 bytes, base64):
 * - Lives only in Vercel/local env, never enters the database, never enters git, is never echoed back
 * - Encryption is refused if it's missing (secure default), rather than storing plaintext
 *
 * Storage format: `v1.<iv_b64>.<tag_b64>.<cipher_b64>`
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = "v1";
const IV_LENGTH = 12; // GCM recommends 12 bytes
const MASTER_KEY_ENV = "ENCRYPTION_MASTER_KEY";

export class CryptoConfigError extends Error {}

function getMasterKey(): Buffer {
  const raw = process.env[MASTER_KEY_ENV];
  if (!raw) {
    throw new CryptoConfigError(
      `Missing the ${MASTER_KEY_ENV} environment variable: cannot encrypt/decrypt sensitive configuration. Please generate a 32-byte base64 key and configure it in .env.local / Vercel (see .env.example)`
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new CryptoConfigError(
      `${MASTER_KEY_ENV} must decode to 32 bytes (roughly 44 base64 characters); it is currently ${key.length} bytes`
    );
  }
  return key;
}

// Whether the current environment has a master key configured (the config page uses this to show "encryption unavailable, cannot save the key")
export function isEncryptionAvailable(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [KEY_VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== KEY_VERSION) {
    throw new CryptoConfigError("Invalid ciphertext format (expected v1.<iv>.<tag>.<cipher>), cannot decrypt");
  }
  const [, ivB64, tagB64, cipherB64] = parts;
  const key = getMasterKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(cipherB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new CryptoConfigError(
      "Decryption failed: the ciphertext may have been tampered with, or the current ENCRYPTION_MASTER_KEY doesn't match the one used to encrypt it"
    );
  }
}

/**
 * Generates a masked value for display in the UI: keeps a few characters at each end, elides
 * the middle.
 * Short values (<12 characters) are fully masked, to avoid the mask itself leaking the whole value.
 */
export function maskSecret(plain: string): string {
  const trimmed = plain.trim();
  if (trimmed.length < 12) return "•••";
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}
