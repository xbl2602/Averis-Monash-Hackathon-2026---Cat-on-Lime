#!/usr/bin/env node
/**
 * Sample email import script (a one-off/repeatable local tool, not an online service). Supports incremental import.
 *
 * Target tables (see SHARED_INTERFACES.md "Database storage layer"):
 * - raw_emails          Raw layer: email fields verbatim + a flattened body
 * - parsed_attachments  Text layer: text parsed from attachments + a flattened version
 * (the verification_results results layer is not written here; the system upserts it by email_id once the pipeline runs)
 *
 * Incremental logic: each row's content_hash is the sha256 fingerprint of "everything this row would store".
 * On re-run, the existing fingerprint is read from the database first: unchanged fingerprint -> skip (no rewrite, updated_at untouched);
 * changed content -> upsert to overwrite. So editing one file only updates the corresponding row, and a full re-run is still fast.
 *
 * Usage (from the project root):
 *   npm run import:data:dry    # parse and print stats only, no database connection (no key needed)
 *   npm run import:data        # incremental import into Supabase (needs the SERVICE_ROLE key in .env.local)
 *   npm run perturb:import     # import the data/perturb perturbation set (--dir=data/perturb, same logic path)
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAttachmentText } from "../lib/shared/attachment-text.ts";
import { normalizeText } from "../lib/shared/normalize.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_ARG = process.argv.find((item) => item.startsWith("--dir="));
const SAMPLE_DIR = path.resolve(
  ROOT,
  DIR_ARG ? DIR_ARG.slice("--dir=".length) : path.join("data", "sample")
);
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  await loadEnvLocal();

  const emails = await loadEmails();
  console.log(`Loaded emails: ${emails.length}`);

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
        unreadable.push(`${row.file_path} (${row.parse_error})`);
      } else if (!samples.has(row.file_format)) {
        samples.set(row.file_format, {
          filename: row.file_path,
          text: row.parsed_text.slice(0, 200),
          normalized: row.normalized_text.slice(0, 200),
        });
      }

      done += 1;
      if (!DRY_RUN && done % 50 === 0) console.log(`  Parsed ${done}/${countAttachments(emails)} attachments`);
    }
  }

  printReport(stats, unreadable, samples);
  if (DRY_RUN) {
    console.log("\n[dry-run] No database writes performed. Fill in the SERVICE_ROLE key and run npm run import:data to import for real.");
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
      parse_error: `Could not read file: ${err instanceof Error ? err.message : String(err)}`,
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
  console.log("\n=== Parse stats (format/result) ===");
  for (const [key, count] of [...stats.entries()].sort()) console.log(`  ${key}: ${count}`);

  console.log("\n=== Unreadable attachments ===");
  if (unreadable.length === 0) console.log("  (none)");
  for (const item of unreadable) console.log(`  - ${item}`);

  console.log("\n=== One sample per format ===");
  for (const [format, sample] of samples.entries()) {
    console.log(`\n-- ${format}: ${sample.filename}`);
    console.log(`   Original: ${sample.text.replace(/\s+/g, " ").slice(0, 120)}`);
    console.log(`   Flattened: ${sample.normalized.slice(0, 120)}`);
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
      "\nMissing environment variables: please fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first\n" +
        "(the SERVICE_ROLE key is under Project Settings -> API in the Supabase dashboard; note that this key must never be committed to git or used in the browser)"
    );
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log("\nComparing fingerprints, writing incrementally to Supabase (upsert)...");

  const existingEmailHashes = await loadExistingHashes(supabase, "raw_emails", ["email_id"]);
  const changedEmails = emailRows.filter((row) => existingEmailHashes.get(row.email_id) !== row.content_hash);
  console.log(`  raw_emails: to write ${changedEmails.length}, skipped (fingerprint unchanged) ${emailRows.length - changedEmails.length}`);
  await upsertInBatches(supabase, "raw_emails", changedEmails, 100, "email_id");

  const existingAttachmentHashes = await loadExistingHashes(supabase, "parsed_attachments", [
    "email_id",
    "file_path",
  ]);
  const changedAttachments = attachmentRows.filter(
    (row) => existingAttachmentHashes.get(`${row.email_id}|${row.file_path}`) !== row.content_hash
  );
  console.log(
    `  parsed_attachments: to write ${changedAttachments.length}, skipped (fingerprint unchanged) ${attachmentRows.length - changedAttachments.length}`
  );
  await upsertInBatches(supabase, "parsed_attachments", changedAttachments, 50, "email_id,file_path");

  console.log("Import complete.");
}

async function loadExistingHashes(supabase, table, keyColumns) {
  const columns = [...keyColumns, "content_hash"].join(",");
  const { data, error } = await supabase.from(table).select(columns).limit(5000);
  if (error) {
    throw new Error(`Failed to read existing fingerprints for ${table}: ${error.message}`);
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
      throw new Error(`Failed to write rows ${i + 1}-${i + batch.length} of ${table}: ${error.message}`);
    }
  }
}

async function loadEnvLocal() {
  let raw = "";
  try {
    raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  } catch {
    return; // --dry-run can still run without .env.local
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
  console.error("\nImport failed:", err);
  process.exit(1);
});
