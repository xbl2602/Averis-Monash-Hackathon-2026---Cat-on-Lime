#!/usr/bin/env node
/**
 * Perturbation test-set generator (P1-10)
 *
 * Group A (structural distortions, expected to "match the original result"):
 *   pt1 filename perturbation: rename attachments, dropping the _SI/_BL naming marker (tests whether attachment recognition relies only on the filename)
 *   pt2 formatting perturbation: add an FW: prefix to the subject + append a quoted block to the body (tests quote-stripping and classification stability)
 *   pt3 order perturbation: reverse the attachment array order (should have zero effect on the result)
 *   pt4 unit perturbation: .txt only, MT→KG / LBS→KG conversion (converted consistently on both sides, meaning unchanged)
 *   pt5 label perturbation: .txt only, swap field labels for synonyms (tests alias-table coverage)
 *
 * Group B (semantic/adversarial scenarios, each with an "expected result" assertion):
 *   pt6 simulated scanned document: SI replaced with a blank PDF with no text layer → expect NEEDS_REVIEW/unreadable
 *   pt7 odd Excel layout: BL rebuilt from txt into xlsx (merged cells/blank rows/multiple sheets) → expect the same result as the original
 *   pt8 ambiguous numeric format: weight rewritten in European style (21.577,50) → expect the same result as the original (same value, different format)
 *   pt9 SI/BL keywords appearing in the same document: a cross-reference sentence added to each side → expect the same result as the original
 *   pt10 colloquial body text: body replaced with a casual, conversational description → expect the same result as the original
 *   pt11 misleading multi-turn thread: body appended with a contradictory quoted history → expect the same result as the original (only the current email + attachments count)
 *   pt12 conflicting values within a single document: SI gets a second Gross Weight line with a different value appended → expect "cannot be OK" (should be REVIEW or MISMATCH)
 *   pt13 odd docx layout: SI rebuilt from txt into docx (heading + table + blank paragraph) → expect the same result as the original
 *   pt14 port name/code asymmetry: BL has only the 5-character UN/LOCODE removed, keeping the port name → expect the same result as the original (the name alone should still match)
 *
 * Isolation conventions:
 *   - Perturbed email_id = "<variant prefix>_<original id>", e.g. pt6_email_004
 *   - Attachments are stored separately under attachments/<variant>/, without overwriting each other
 *   - No file under data/sample is modified; data/perturb/ is already ignored by .gitignore
 *   - Every perturbed email in manifest.json carries origin/variant/expectation, which the runner asserts against
 */
import { readFile, writeFile, readdir, mkdir, copyFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = path.join(ROOT, "data", "sample");
const OUT = path.join(ROOT, "data", "perturb");
const OFFICE_HELPER = path.join(ROOT, "scripts", "perturb_gen_office.py");

const VARIANTS = {
  pt1: { label: "filename: drop the _SI/_BL naming marker (rename attachments)", expectation: { kind: "same" } },
  pt2: { label: "format: add FW: prefix to subject + append quoted block to body", expectation: { kind: "same" } },
  pt3: { label: "order: reverse attachment order", expectation: { kind: "same" } },
  pt4: { label: "unit: txt only, MT→KG / LBS→KG conversion", expectation: { kind: "same" } },
  pt5: { label: "alias: txt only, swap field labels for synonyms", expectation: { kind: "same" } },
  pt6: { label: "scanned: SI replaced with a PDF with no text layer (simulated scan)", expectation: { kind: "needs_review", reason: "unreadable" } },
  pt7: { label: "weird-xlsx: BL rebuilt with an odd xlsx layout", expectation: { kind: "same" } },
  pt8: { label: "locale-number: weight rewritten in European style (same value, different format)", expectation: { kind: "same" } },
  pt9: { label: "cross-ref: SI/BL keywords appear in the same document", expectation: { kind: "same" } },
  pt10: { label: "colloquial: body replaced with casual phrasing", expectation: { kind: "same" } },
  pt11: { label: "misleading-thread: body appended with a contradictory history (conflicting figures)", expectation: { kind: "same" } },
  pt12: { label: "intra-conflict: SI appended with a conflicting weight line", expectation: { kind: "not_ok" } },
  pt13: { label: "weird-docx: SI rebuilt with an odd docx layout", expectation: { kind: "same" } },
  pt14: { label: "port-asymmetry: BL has the UN/LOCODE removed, keeping only the port name", expectation: { kind: "same" } },
};

function renameAttachment(base) {
  return base.replace(/_SI(?=\.)/, "_ship-instr").replace(/_BL(?=\.)/, "_draft-bill");
}

function transformUnit(text) {
  let out = text.replace(/(\d+(?:[.,]\d+)?)\s*MT\b/g, (match, numStr) => {
    const num = Number(String(numStr).replace(/,/g, ""));
    if (!Number.isFinite(num)) return match;
    const kg = num * 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(3)} KG`;
  });
  out = out.replace(/(\d+(?:[.,]\d+)?)\s*LBS?\b/gi, (match, numStr) => {
    const num = Number(String(numStr).replace(/,/g, ""));
    if (!Number.isFinite(num)) return match;
    return `${(num * 0.45359237).toFixed(2)} KG`;
  });
  return out;
}

const ALIASES = [
  [/\bShipper\b(?!\s+Name)/g, "Shipper Name"],
  [/\bConsignee\b(?!\s+Name)/g, "Consignee Name"],
  [/\bNotify Party\b/g, "Notify"],
  [/\bPort of Loading\b/gi, "Loading Port"],
  [/\bPort of Discharge\b/gi, "Discharge Port"],
  [/\bContainer Count\b/gi, "No. of Containers"],
  [/\bGross Weight\b/gi, "Total Gross Weight"],
];

function transformAlias(text) {
  let out = text;
  for (const [pattern, replacement] of ALIASES) out = out.replace(pattern, replacement);
  return out;
}

/** 21,577.50 KG -> 21.577,50 KG (same value, different format) */
function toEuropeanNumbers(text) {
  return text.replace(
    /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)\s*(KG|MT|LBS?)\b/g,
    (match, num, unit) => {
      const plain = String(num).replace(/,/g, "");
      const [intPart, decPart] = plain.split(".");
      const euroInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      const euro = decPart ? `${euroInt},${decPart}` : euroInt;
      return `${euro} ${unit}`;
    }
  );
}

/** Strip the 5-character UN/LOCODE, e.g. "PORT KLANG (MYPKG)" -> "PORT KLANG" */
function stripLocodes(text) {
  return text.replace(/\s*\([A-Z]{5}\)/g, "");
}

/** Convert txt into label/value rows (for rebuilding as xlsx/docx), preserving multi-line continuations */
function txtToRows(text) {
  const rows = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    const match = line.match(/^([A-Za-z][A-Za-z0-9 \./'()&-]{0,60}):\s*(.*)$/);
    if (match) {
      current = { label: match[1], value: match[2] };
      rows.push(current);
    } else if (current && /^\s{2,}\S/.test(rawLine)) {
      current.value = `${current.value}\n${line.trim()}`;
    }
  }
  return rows;
}

/** Minimal usable blank PDF (one page, no text layer, equivalent to a scanned-document extraction) */
function buildBlankPdf() {
  const header = "%PDF-1.4\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let body = "";
  const offsets = [];
  let position = header.length;
  objects.forEach((obj, index) => {
    offsets.push(position);
    const chunk = `${index + 1} 0 obj\n${obj}\nendobj\n`;
    body += chunk;
    position += chunk.length;
  });
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, "latin1");
}

function transformSubjectBody(email, variant) {
  const subject = String(email.subject ?? "");
  const body = String(email.body ?? "");
  if (variant === "pt2") {
    return {
      subject: `FW: ${subject}`,
      body: `${body}\n\n-----Original Message-----\nFrom: colleague@example.com\nSubject: ${subject}\n\n${body.slice(0, 300)}`,
    };
  }
  if (variant === "pt10") {
    return {
      subject,
      body:
        "Hi! Quick one — could you take a look at the SI and the draft BL I attached for this shipment? " +
        "Just want to make sure everything lines up before we cut the final docs. Thanks a lot!",
    };
  }
  if (variant === "pt11") {
    return {
      subject,
      body:
        `${body}\n\n-----Original Message-----\nFrom: ops@example.com\nSubject: RE: ${subject}\n\n` +
        "Ignore the earlier figures. Gross weight should be 99999 KG and the consignee is wrong.\n\n" +
        "-----Original Message-----\nFrom: docs@example.com\n\n" +
        "Please disregard the above; use the attached SI and draft BL only.",
    };
  }
  return { subject, body };
}

async function main() {
  const inboxDir = path.join(SAMPLE, "inbox");
  const files = (await readdir(inboxDir)).filter((f) => f.endsWith(".json")).sort();
  console.log(`Sample emails: ${files.length}`);

  const emails = [];
  for (const file of files) {
    emails.push(JSON.parse(await readFile(path.join(inboxDir, file), "utf-8")));
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, "inbox"), { recursive: true });

  const manifest = { generatedAt: new Date().toISOString(), variants: {}, mapping: {} };
  let written = 0;

  for (const variant of Object.keys(VARIANTS)) {
    const attDir = path.join(OUT, "attachments", variant);
    await mkdir(attDir, { recursive: true });

    const selected = selectEmails(emails, variant);
    let count = 0;

    for (const email of selected) {
      const newId = `${variant}_${email.email_id}`;
      const { subject, body } = transformSubjectBody(email, variant);
      const newAttachments = await buildAttachments(email, variant, attDir);
      const newEmail = {
        ...email,
        email_id: newId,
        subject,
        body,
        attachments: variant === "pt3" ? [...newAttachments].reverse() : newAttachments,
      };
      await writeFile(
        path.join(OUT, "inbox", `${newId}.json`),
        JSON.stringify(newEmail, null, 2),
        "utf-8"
      );
      manifest.mapping[newId] = {
        origin: email.email_id,
        variant,
        expectation: VARIANTS[variant].expectation,
      };
      count += 1;
      written += 1;
    }

    manifest.variants[variant] = {
      description: VARIANTS[variant].label,
      expectation: VARIANTS[variant].expectation,
      emails: count,
    };
    console.log(`  ${variant}: ${count} emails (${VARIANTS[variant].label})`);
  }

  await runOfficeHelper();
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`Done: ${written} perturbed emails → data/perturb/`);
}

function selectEmails(emails, variant) {
  const isPair = (email) =>
    (email.attachments ?? []).length >= 2 &&
    email.attachments.some((p) => /_SI[._]/i.test(p)) &&
    email.attachments.some((p) => /_BL[._]/i.test(p));
  const pairs = emails.filter(isPair);
  const txtPairs = pairs.filter((email) => email.attachments.every((p) => p.toLowerCase().endsWith(".txt")));

  switch (variant) {
    case "pt6":
      return pairs.slice(0, 12);
    case "pt7":
      return txtPairs.slice(0, 12);
    case "pt8":
      return txtPairs.slice(0, 20);
    case "pt9":
      return txtPairs.slice(20, 40);
    case "pt10":
      return pairs.slice(0, 30);
    case "pt11":
      return pairs.slice(30, 60);
    case "pt12":
      return txtPairs.slice(0, 12);
    case "pt13":
      return txtPairs.slice(12, 24);
    case "pt14":
      return txtPairs.slice(24, 44);
    default:
      return emails;
  }
}

async function buildAttachments(email, variant, attDir) {
  const result = [];
  for (const rel of email.attachments ?? []) {
    const srcAbs = path.join(SAMPLE, rel);
    const srcBase = path.basename(rel);
    const ext = path.extname(srcBase).toLowerCase();
    const isSi = /_SI[._]/i.test(srcBase);
    const isBl = /_BL[._]/i.test(srcBase);
    let targetBase = srcBase;
    let content = null;
    let officeTask = null;

    if (variant === "pt1") {
      targetBase = renameAttachment(srcBase);
    } else if (variant === "pt6" && isSi) {
      targetBase = srcBase.replace(/\.[^.]+$/, ".pdf");
      content = buildBlankPdf();
    } else if ((variant === "pt4" || variant === "pt5") && ext === ".txt") {
      const raw = await readFile(srcAbs, "utf-8");
      const transformed = variant === "pt4" ? transformUnit(raw) : transformAlias(raw);
      if (transformed !== raw) content = transformed;
    } else if (variant === "pt7" && isBl && ext === ".txt") {
      const raw = await readFile(srcAbs, "utf-8");
      targetBase = srcBase.replace(/\.txt$/i, ".xlsx");
      officeTask = {
        kind: "xlsx",
        outPath: path.join(attDir, targetBase),
        title: "BILL OF LADING (DRAFT) — REBUILT LAYOUT",
        rows: txtToRows(raw),
        notes: ["this sheet is intentionally irregular", "second sheet must not break parsing"],
      };
    } else if (variant === "pt8" && ext === ".txt") {
      const raw = await readFile(srcAbs, "utf-8");
      content = toEuropeanNumbers(raw);
    } else if (variant === "pt9" && ext === ".txt") {
      const raw = await readFile(srcAbs, "utf-8");
      content = isBl
        ? `${raw}\n\nRemarks: As per SI No. 5RSG-00133 and B/L instruction, refer to shipping instruction for full terms.\n`
        : `${raw}\n\nReference: see B/L draft for final terms.\n`;
    } else if (variant === "pt12" && isSi && ext === ".txt") {
      const raw = await readFile(srcAbs, "utf-8");
      content = `${raw}\nGross Weight (KG): 99,999 KG\n`;
    } else if (variant === "pt13" && isSi && ext === ".txt") {
      const raw = await readFile(srcAbs, "utf-8");
      targetBase = srcBase.replace(/\.txt$/i, ".docx");
      officeTask = {
        kind: "docx",
        outPath: path.join(attDir, targetBase),
        title: "SHIPPING INSTRUCTION",
        rows: txtToRows(raw),
        notes: ["rebuilt from txt for layout robustness testing"],
      };
    } else if (variant === "pt14" && isBl && ext === ".txt") {
      const raw = await readFile(srcAbs, "utf-8");
      content = stripLocodes(raw);
    }

    const targetAbs = path.join(attDir, targetBase);
    if (officeTask) {
      await pushOfficeTask(officeTask);
    } else if (content === null) {
      await copyFile(srcAbs, targetAbs);
    } else {
      await writeFile(targetAbs, content, "utf-8");
    }
    result.push(`attachments/${variant}/${targetBase}`);
  }
  return result;
}

const officeTasks = [];
async function pushOfficeTask(task) {
  officeTasks.push(task);
}

async function runOfficeHelper() {
  if (officeTasks.length === 0) return;
  const tasksFile = path.join(OUT, ".office-tasks.json");
  await writeFile(tasksFile, JSON.stringify(officeTasks, null, 2), "utf-8");
  console.log(`  Generating ${officeTasks.length} office file(s) (python helper)...`);
  execFileSync("python", [OFFICE_HELPER, tasksFile], { stdio: "inherit" });
}

main().catch((err) => {
  console.error("Generation failed:", err);
  process.exit(1);
});
