/**
 * Encryption module self-test (no real key needed: the script generates its own temporary master key and discards it when done).
 *
 * Usage: npm run test:crypto
 *
 * Covers 4 cases:
 *   1. Encrypt/decrypt round trip (including the ciphertext format v1.<iv>.<tag>.<cipher>)
 *   2. Tampering with ciphertext must raise an error (AES-GCM auth tag, prevents silently decrypting garbage)
 *   3. Encryption is refused when ENCRYPTION_MASTER_KEY is missing (secure default)
 *   4. maskSecret never contains the full plaintext; short values are fully masked
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CryptoConfigError, decryptSecret, encryptSecret, maskSecret } from "../lib/shared/crypto.ts";

const PLAIN = "sk-test-abcd1234567890";

function run(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

console.log("crypto-self-test:\n");

run("encrypt/decrypt round trip", () => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString("base64");
  const cipher = encryptSecret(PLAIN);
  assert.match(cipher, /^v1\./, "Ciphertext should carry the v1. version prefix");
  assert.notEqual(cipher, PLAIN, "Ciphertext must not equal the plaintext");
  assert.ok(!cipher.includes(PLAIN), "Ciphertext should not contain the plaintext");
  assert.equal(decryptSecret(cipher), PLAIN, "Decryption should restore the original plaintext");
});

run("tampered ciphertext must raise an error", () => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString("base64");
  const cipher = encryptSecret(PLAIN);
  const parts = cipher.split(".");
  // Decode the ciphertext bytes, flip 1 bit, then re-encode: this guarantees a byte actually changed
  // (flipping the last base64 character directly is unreliable: it may only encode padding bits, leaving the decoded result unchanged)
  const bytes = Buffer.from(parts[3], "base64");
  bytes[0] ^= 0x01;
  const tampered = [...parts.slice(0, 3), bytes.toString("base64")].join(".");
  assert.throws(() => decryptSecret(tampered), /解密失败/);
});

run("encryption is refused when ENCRYPTION_MASTER_KEY is missing", () => {
  delete process.env.ENCRYPTION_MASTER_KEY;
  assert.throws(
    () => encryptSecret(PLAIN),
    (err) => err instanceof CryptoConfigError && /ENCRYPTION_MASTER_KEY/.test(err.message)
  );
});

run("maskSecret does not leak the plaintext", () => {
  const masked = maskSecret(PLAIN);
  assert.ok(!masked.includes(PLAIN), "The mask should not contain the full plaintext");
  assert.equal(maskSecret("short"), "•••", "Short values should be fully masked");
});

if (process.exitCode === 1) {
  console.error("\nThere are failing checks.");
} else {
  console.log("\nAll passed.");
}
