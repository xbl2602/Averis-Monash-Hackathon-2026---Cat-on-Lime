/**
 * 第二阶段一次性初始化（可重复跑，幂等）：
 * 1. 检查 .env.local，缺 ENCRYPTION_MASTER_KEY / ADMIN_TOKEN 就生成并写入
 * 2. 尝试连接 Supabase，检查表是否已建好
 * 3. 表不存在时：提示去 Supabase 控制台执行 scripts/phase2-schema.sql（REST 不支持 DDL，这是官方推荐做法）
 * 4. 可用时创建 Storage bucket `uploads`（private）
 *
 * 用法：node scripts/setup-phase2.mjs
 * 表结构见 PHASE2_SPEC.md 第 3.1 / 4.1 / 5.1 节。
 */
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");
const BUCKET = "uploads";

function log(message) {
  console.log(`[setup] ${message}`);
}

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) map.set(match[1], match[2]);
  }
  return map;
}

function appendEnv(content, key, value) {
  const block = [
    "",
    "# --- 第二阶段：配置中心（scripts/setup-phase2.mjs 自动生成） ---",
    `${key}=${value}`,
    "",
  ].join("\n");
  return content.endsWith("\n") ? content + block.slice(1) : content + block;
}

async function ensureLocalSecrets() {
  let content;
  try {
    content = await readFile(ENV_PATH, "utf8");
  } catch {
    throw new Error("找不到 .env.local（这个脚本要从里面读 Supabase 配置）");
  }
  const env = parseEnv(content);
  const generated = [];

  if (!env.get("ENCRYPTION_MASTER_KEY")) {
    content = appendEnv(content, "ENCRYPTION_MASTER_KEY", randomBytes(32).toString("base64"));
    generated.push("ENCRYPTION_MASTER_KEY");
  } else {
    log("ENCRYPTION_MASTER_KEY 已存在，跳过生成");
  }
  if (!env.get("ADMIN_TOKEN")) {
    content = appendEnv(content, "ADMIN_TOKEN", randomBytes(24).toString("base64url"));
    generated.push("ADMIN_TOKEN");
  } else {
    log("ADMIN_TOKEN 已存在，跳过生成");
  }

  if (generated.length > 0) {
    await writeFile(ENV_PATH, content, "utf8");
    log(`已写入 .env.local：${generated.join(" / ")}（不要把这些值发到任何聊天里）`);
  }
  return parseEnv(content);
}

async function main() {
  await ensureLocalSecrets();
  const env = parseEnv(await readFile(ENV_PATH, "utf8"));
  const url = env.get("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，无法连接数据库");
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false } });

  log("检查数据库表...");
  const missing = [];
  for (const table of ["app_config", "mail_accounts", "supabase_projects", "uploaded_documents"]) {
    const { error } = await client.from(table).select("*").limit(1);
    // 未建表时 Supabase 的报错文案有两种：旧版 "does not exist"、新版 "Could not find the table ... in the schema cache"
    const notFound = error && /does not exist|could not find the table|schema cache/i.test(error.message);
    if (notFound) {
      missing.push(table);
    } else if (error) {
      log(`检查 ${table} 时返回：${error.message}（继续）`);
    }
  }

  if (missing.length > 0) {
    log(`以下表还不存在：${missing.join(" / ")}`);
    log("Supabase 的 API 不支持建表（官方设计如此）。请：");
    log("  1) 打开 Supabase 控制台 → SQL Editor");
    log("  2) 把 scripts/phase2-schema.sql 全部内容粘进去执行");
    log("  3) 重新运行本脚本");
    process.exitCode = 2;
    return;
  }
  log("4 张表都已存在");

  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(`列 Storage buckets 失败：${listError.message}`);
  if (buckets.some((bucket) => bucket.name === BUCKET)) {
    log(`Storage bucket "${BUCKET}" 已存在`);
  } else {
    const { error } = await client.storage.createBucket(BUCKET, { public: false });
    if (error) throw new Error(`创建 bucket 失败：${error.message}`);
    log(`已创建私有 Storage bucket "${BUCKET}"`);
  }

  log("完成。重启 dev server（npm run dev）后：GET /features/config/api 应返回配置列表。");
}

main().catch((err) => {
  console.error(`[setup] 失败：${err.message}`);
  process.exitCode = 1;
});
