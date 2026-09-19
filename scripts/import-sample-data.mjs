#!/usr/bin/env node
/**
 * 样例邮件导入脚本（本地跑的一次性/可重复执行工具，不是线上服务）。支持增量导入。
 *
 * 目标表（见 SHARED_INTERFACES.md「数据库存储层」）：
 * - raw_emails          原始层：邮件原样字段 + 正文扁平化版本
 * - parsed_attachments  文字层：附件解析出的文字 + 扁平化版本
 * （verification_results 结果层不在这里写，等流水线跑通后由系统按 email_id upsert）
 *
 * 增量逻辑：每行的 content_hash 是"这一行要存的全部内容"的 sha256 指纹。
 * 重跑时先读库里的指纹：指纹没变 → 跳过（不重写、不动 updated_at）；
 * 内容变了 → upsert 覆盖。所以改一个文件只更新对应行，全量重跑也很快。
 *
 * 用法（在项目根目录）：
 *   npm run import:data:dry    # 只解析、打印统计，不连数据库（不需要 key）
 *   npm run import:data        # 增量导入到 Supabase（需要 .env.local 里的 SERVICE_ROLE key）
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAttachmentText } from "../lib/shared/attachment-text.ts";
import { normalizeText } from "../lib/shared/normalize.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE_DIR = path.join(ROOT, "data", "sample");
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  await loadEnvLocal();

  const emails = await loadEmails();
  console.log(`读入邮件：${emails.length} 封`);

  const emailRows = emails.map((email) => {
    const row = {
      email_id: email.email_id,
      from_address: email.from,
      subject: email.subject,
      body: email.body,
      normalized_body: normalizeText(email.body),
      attachment_paths: email.attachments,
    };
    return { ...row, content_hash: hashObject(row) };
  });

  const attachmentRows = [];
  const stats = new Map(); // "format/status" -> count
  const unreadable = [];
  const samples = new Map(); // format -> { filename, text, normalized }

  let done = 0;
  for (const email of emails) {
    for (const attachmentPath of email.attachments) {
      const row = await processAttachment(email.email_id, attachmentPath);
      attachmentRows.push(row);

      const key = `${row.file_format}/${row.parse_status}`;
      stats.set(key, (stats.get(key) ?? 0) + 1);
      if (row.parse_status === "unreadable") {
        unreadable.push(`${row.file_path}（${row.parse_error}）`);
      } else if (!samples.has(row.file_format)) {
        samples.set(row.file_format, {
          filename: row.file_path,
          text: row.parsed_text.slice(0, 200),
          normalized: row.normalized_text.slice(0, 200),
        });
      }

      done += 1;
      if (!DRY_RUN && done % 50 === 0) console.log(`  已解析 ${done}/${countAttachments(emails)} 个附件`);
    }
  }

  printReport(stats, unreadable, samples);
  if (DRY_RUN) {
    console.log("\n[dry-run] 没有写数据库。填好 SERVICE_ROLE key 后运行 npm run import:data 正式导入。");
    return;
  }
  await writeToSupabase(emailRows, attachmentRows);
}

async function processAttachment(emailId, attachmentPath) {
  const filename = path.basename(attachmentPath);
  let buffer;
  try {
    buffer = await readFile(path.join(SAMPLE_DIR, attachmentPath));
  } catch (err) {
    const row = {
      email_id: emailId,
      file_path: attachmentPath,
      file_format: "unsupported",
      parse_status: "unreadable",
      parse_error: `文件读不到：${err instanceof Error ? err.message : String(err)}`,
      parsed_text: "",
      normalized_text: "",
    };
    return { ...row, content_hash: hashObject(row) };
  }

  const parsed = await extractAttachmentText(filename, buffer);
  const row = {
    email_id: emailId,
    file_path: attachmentPath,
    file_format: parsed.format,
    parse_status: parsed.status,
    parse_error: parsed.error ?? null,
    parsed_text: parsed.text,
    normalized_text: normalizeText(parsed.text),
  };
  return { ...row, content_hash: hashObject(row) };
}

function hashObject(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function printReport(stats, unreadable, samples) {
  console.log("\n=== 解析统计（格式/结果）===");
  for (const [key, count] of [...stats.entries()].sort()) console.log(`  ${key}: ${count}`);

  console.log("\n=== 读不了的附件 ===");
  if (unreadable.length === 0) console.log("  （无）");
  for (const item of unreadable) console.log(`  - ${item}`);

  console.log("\n=== 每种格式抽 1 个样本 ===");
  for (const [format, sample] of samples.entries()) {
    console.log(`\n-- ${format}：${sample.filename}`);
    console.log(`   原文: ${sample.text.replace(/\s+/g, " ").slice(0, 120)}`);
    console.log(`   扁平化: ${sample.normalized.slice(0, 120)}`);
  }
}

async function loadEmails() {
  const inboxDir = path.join(SAMPLE_DIR, "inbox");
  const files = (await readdir(inboxDir)).filter((f) => f.endsWith(".json")).sort();
  const emails = [];
  for (const file of files) {
    const raw = await readFile(path.join(inboxDir, file), "utf-8");
    emails.push(JSON.parse(raw));
  }
  return emails;
}

function countAttachments(emails) {
  return emails.reduce((sum, email) => sum + email.attachments.length, 0);
}

async function writeToSupabase(emailRows, attachmentRows) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "\n缺少环境变量：请先在 .env.local 里填好 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY\n" +
        "（SERVICE_ROLE key 在 Supabase 后台 Project Settings → API 里，注意这个 key 不能提交进 git、也不能给浏览器用）"
    );
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log("\n比对指纹、增量写入 Supabase（upsert）...");

  const existingEmailHashes = await loadExistingHashes(supabase, "raw_emails", ["email_id"]);
  const changedEmails = emailRows.filter((row) => existingEmailHashes.get(row.email_id) !== row.content_hash);
  console.log(`  raw_emails: 待写入 ${changedEmails.length}，跳过（指纹未变）${emailRows.length - changedEmails.length}`);
  await upsertInBatches(supabase, "raw_emails", changedEmails, 100, "email_id");

  const existingAttachmentHashes = await loadExistingHashes(supabase, "parsed_attachments", [
    "email_id",
    "file_path",
  ]);
  const changedAttachments = attachmentRows.filter(
    (row) => existingAttachmentHashes.get(`${row.email_id}|${row.file_path}`) !== row.content_hash
  );
  console.log(
    `  parsed_attachments: 待写入 ${changedAttachments.length}，跳过（指纹未变）${attachmentRows.length - changedAttachments.length}`
  );
  await upsertInBatches(supabase, "parsed_attachments", changedAttachments, 50, "email_id,file_path");

  console.log("导入完成。");
}

async function loadExistingHashes(supabase, table, keyColumns) {
  const columns = [...keyColumns, "content_hash"].join(",");
  const { data, error } = await supabase.from(table).select(columns).limit(5000);
  if (error) {
    throw new Error(`读取 ${table} 现有指纹失败：${error.message}`);
  }
  const map = new Map();
  for (const row of data) {
    map.set(keyColumns.map((c) => row[c]).join("|"), row.content_hash);
  }
  return map;
}

async function upsertInBatches(supabase, table, rows, batchSize, onConflict) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`写入 ${table} 第 ${i + 1}~${i + batch.length} 行失败：${error.message}`);
    }
  }
}

async function loadEnvLocal() {
  let raw = "";
  try {
    raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  } catch {
    return; // 没有 .env.local 也可以跑 --dry-run
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

main().catch((err) => {
  console.error("\n导入失败：", err);
  process.exit(1);
});
