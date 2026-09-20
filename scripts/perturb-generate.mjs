#!/usr/bin/env node
/**
 * 扰动测试集生成器（P1-10）
 *
 * A 组（结构变形，期望"与原结果一致"）：
 *   pt1 文件名扰动：附件改名，去掉 _SI/_BL 命名标记（考验附件识别是否只靠文件名）
 *   pt2 形式扰动：主题加 FW: 前缀 + 正文追加引用块（考验引用剥离与分类稳定性）
 *   pt3 顺序扰动：附件数组顺序反转（应当完全不影响结果）
 *   pt4 单位扰动：仅 .txt，MT→KG / LBS→KG 换算（两侧一致换算，语义不变）
 *   pt5 标签扰动：仅 .txt，字段标签换同义说法（考验别名表覆盖）
 *
 * B 组（语义/对抗场景，逐条带"期望结果"断言）：
 *   pt6 扫描件模拟：SI 换成无文字层的空白 PDF → 期望 NEEDS_REVIEW/unreadable
 *   pt7 怪 Excel 布局：BL 由 txt 重建为 xlsx（合并单元格/空行/多 sheet）→ 期望与原结果一致
 *   pt8 数字多义：重量改成欧式写法（21.577,50）→ 期望与原结果一致（同值异格式）
 *   pt9 文档内同时出现 SI/BL 关键词：两侧各加一句互引 → 期望与原结果一致
 *   pt10 白话文正文：正文换成随意口语描述 → 期望与原结果一致
 *   pt11 误导性多轮口径：正文追加互相矛盾的历史邮件 → 期望与原结果一致（以当前邮件+附件为准）
 *   pt12 单文档内冲突值：SI 追加第二个不同重量的 Gross Weight 行 → 期望"不能是 OK"（应 REVIEW 或 MISMATCH）
 *   pt13 docx 怪布局：SI 由 txt 重建为 docx（标题+表格+空段）→ 期望与原结果一致
 *   pt14 港名/代码不对称：BL 只去掉 5 位 UN/LOCODE，保留港名 → 期望与原结果一致（名字应能匹配）
 *
 * 隔离约定：
 *   - 扰动邮件 email_id = "<变体前缀>_<原 id>"，例如 pt6_email_004
 *   - 附件各自存放在 attachments/<变体>/ 下，互不覆盖
 *   - 不修改 data/sample 任何文件；data/perturb/ 已被 .gitignore 忽略
 *   - manifest.json 里每个扰动邮件都带 origin/variant/expectation，执行器按期望断言
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
  pt1: { label: "filename：去掉 _SI/_BL 命名标记（附件改名）", expectation: { kind: "same" } },
  pt2: { label: "format：主题加 FW: 前缀 + 正文追加引用块", expectation: { kind: "same" } },
  pt3: { label: "order：附件顺序反转", expectation: { kind: "same" } },
  pt4: { label: "unit：仅 txt，MT→KG / LBS→KG 换算", expectation: { kind: "same" } },
  pt5: { label: "alias：仅 txt，字段标签换同义说法", expectation: { kind: "same" } },
  pt6: { label: "scanned：SI 换成无文字层 PDF（模拟扫描件）", expectation: { kind: "needs_review", reason: "unreadable" } },
  pt7: { label: "weird-xlsx：BL 重建为怪布局 xlsx", expectation: { kind: "same" } },
  pt8: { label: "locale-number：重量改欧式写法（同值异格式）", expectation: { kind: "same" } },
  pt9: { label: "cross-ref：文档内同时出现 SI/BL 关键词", expectation: { kind: "same" } },
  pt10: { label: "colloquial：正文换白话文", expectation: { kind: "same" } },
  pt11: { label: "misleading-thread：正文追加矛盾历史（多次改口径）", expectation: { kind: "same" } },
  pt12: { label: "intra-conflict：SI 追加冲突重量行", expectation: { kind: "not_ok" } },
  pt13: { label: "weird-docx：SI 重建为怪布局 docx", expectation: { kind: "same" } },
  pt14: { label: "port-asymmetry：BL 去掉 UN/LOCODE 只留港名", expectation: { kind: "same" } },
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

/** 21,577.50 KG -> 21.577,50 KG（同值、异格式） */
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

/** 去掉 5 位 UN/LOCODE，例如 "PORT KLANG (MYPKG)" -> "PORT KLANG" */
function stripLocodes(text) {
  return text.replace(/\s*\([A-Z]{5}\)/g, "");
}

/** txt 转 label/value 行（供重建 xlsx/docx 用），保留多行续行 */
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

/** 最小可用空白 PDF（一页、无文字层，等价扫描件提取效果） */
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
  console.log(`样例邮件：${files.length} 封`);

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
    console.log(`  ${variant}: ${count} 封（${VARIANTS[variant].label}）`);
  }

  await runOfficeHelper();
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`完成：${written} 封扰动邮件 → data/perturb/`);
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
  console.log(`  生成 office 文件 ${officeTasks.length} 个（python helper）...`);
  execFileSync("python", [OFFICE_HELPER, tasksFile], { stdio: "inherit" });
}

main().catch((err) => {
  console.error("生成失败：", err);
  process.exit(1);
});
