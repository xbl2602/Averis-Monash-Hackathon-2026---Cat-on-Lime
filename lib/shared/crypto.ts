/**
 * 敏感字段加密（第二阶段 SPEC 第 2 节，方案：AES-256-GCM）。
 *
 * 为什么是这套：
 * - 对称加密：存的是 API key / OAuth token，服务端调用第三方时必须还原成明文，排除哈希和非对称
 * - GCM：加密同时生成认证标签，密文被篡改一个 bit 就会解密失败（CBC 没有这个保护）
 * - Node 原生 crypto，零依赖；256 位密钥对成本的影响为零
 * - 密文带版本前缀（v1.），将来轮换主密钥时可以 v2 新写、v1 旧读，平滑迁移
 *
 * 主密钥来自环境变量 ENCRYPTION_MASTER_KEY（32 字节 base64）：
 * - 只在 Vercel/本地 env 里，永不进数据库、永不进 git、永不回显
 * - 缺失时拒绝加密（安全默认），而不是明文落库
 *
 * 存储格式：`v1.<iv_b64>.<tag_b64>.<cipher_b64>`
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = "v1";
const IV_LENGTH = 12; // GCM 推荐 12 字节
const MASTER_KEY_ENV = "ENCRYPTION_MASTER_KEY";

export class CryptoConfigError extends Error {}

function getMasterKey(): Buffer {
  const raw = process.env[MASTER_KEY_ENV];
  if (!raw) {
    throw new CryptoConfigError(
      `缺少 ${MASTER_KEY_ENV} 环境变量：无法加密/解密敏感配置。请生成一个 32 字节 base64 密钥并配置到 .env.local / Vercel（见 .env.example）`
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new CryptoConfigError(
      `${MASTER_KEY_ENV} 解码后必须是 32 字节（base64 的 44 个字符左右），当前是 ${key.length} 字节`
    );
  }
  return key;
}

// 当前环境有没有配主密钥（配置页据此提示"加密不可用，无法保存 key"）
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
    throw new CryptoConfigError("密文格式不合法（期望 v1.<iv>.<tag>.<cipher>），无法解密");
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
      "解密失败：密文可能被篡改，或当前 ENCRYPTION_MASTER_KEY 与加密时用的不是同一把"
    );
  }
}

/**
 * 生成给界面回显的掩码：保留首尾少量字符，中间省略。
 * 短值（<12 字符）全部打码，避免"掩码反而泄露完整值"。
 */
export function maskSecret(plain: string): string {
  const trimmed = plain.trim();
  if (trimmed.length < 12) return "•••";
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}
