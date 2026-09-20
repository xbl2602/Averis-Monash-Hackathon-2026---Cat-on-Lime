/**
 * 加密模块自测（不需要真实 key：脚本自己生成临时主密钥，用完即弃）。
 *
 * 用法：npm run test:crypto
 *
 * 覆盖 4 项：
 *   1. 加解密往返（含密文格式 v1.<iv>.<tag>.<cipher>）
 *   2. 篡改密文必须报错（AES-GCM 认证标签，防静默解出垃圾）
 *   3. 缺 ENCRYPTION_MASTER_KEY 时拒绝加密（安全默认）
 *   4. maskSecret 不包含完整明文、短值全打码
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CryptoConfigError, decryptSecret, encryptSecret, maskSecret } from "../lib/shared/crypto.ts";

const PLAIN = "sk-test-abcd1234567890";

function run(name, fn) {
  try {
    fn();
    console.log(`  [通过] ${name}`);
  } catch (err) {
    console.error(`  [失败] ${name}：${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}

console.log("crypto-self-test：\n");

run("加解密往返", () => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString("base64");
  const cipher = encryptSecret(PLAIN);
  assert.match(cipher, /^v1\./, "密文应带 v1. 版本前缀");
  assert.notEqual(cipher, PLAIN, "密文不能等于明文");
  assert.ok(!cipher.includes(PLAIN), "密文不应包含明文");
  assert.equal(decryptSecret(cipher), PLAIN, "解密结果应还原明文");
});

run("篡改密文必须报错", () => {
  process.env.ENCRYPTION_MASTER_KEY = randomBytes(32).toString("base64");
  const cipher = encryptSecret(PLAIN);
  const parts = cipher.split(".");
  // 解出密文字节后翻转 1 bit 再编码回去：保证真的改了字节
  // （直接翻 base64 最后一个字符不可靠：它可能只编码了填充位，解码结果不变）
  const bytes = Buffer.from(parts[3], "base64");
  bytes[0] ^= 0x01;
  const tampered = [...parts.slice(0, 3), bytes.toString("base64")].join(".");
  assert.throws(() => decryptSecret(tampered), /解密失败/);
});

run("缺 ENCRYPTION_MASTER_KEY 时拒绝加密", () => {
  delete process.env.ENCRYPTION_MASTER_KEY;
  assert.throws(
    () => encryptSecret(PLAIN),
    (err) => err instanceof CryptoConfigError && /ENCRYPTION_MASTER_KEY/.test(err.message)
  );
});

run("maskSecret 不泄露明文", () => {
  const masked = maskSecret(PLAIN);
  assert.ok(!masked.includes(PLAIN), "掩码不应包含完整明文");
  assert.equal(maskSecret("short"), "•••", "短值应全部打码");
});

if (process.exitCode === 1) {
  console.error("\n存在失败项。");
} else {
  console.log("\n全部通过。");
}
