/**
 * 从 SI/BL 文档文本里用"标签规则"解析 7 个字段（不调用模型）。
 * 覆盖样例数据里出现过的全部版式（txt / xlsx / docx / 文字层 PDF 解析出的文本）：
 * - 标签变体：Shipper/Exporter、Consignee / To the Order of（提单常见）、Notify Party、
 *   POL / Load Port / Port of Loading、POD / Discharge Port / Port of Discharge、
 *   Total Containers / No. of Containers or Packages、Gross Wt / Gross Weight / TOTAL Gross Weightnn
 * - 值的位置：有的和标签同一行（txt/xlsx），有的在下面几行（docx/pdf）
 * - 占位符（TBA / N/A / ____MT / 空值）视为"没有这个字段"，交给上层判 missing_value
 */
import type { ComparedField, ExtractedDocumentFields } from "@/lib/shared/types";

interface LabelDef {
  field: ComparedField;
  patterns: RegExp[];
}

const LABELS: LabelDef[] = [
  { field: "shipper", patterns: [/^shipper(?:\/exporter)?\b/] },
  { field: "consignee", patterns: [/^consignee\b/, /^to the order of\b/] },
  { field: "notify_party", patterns: [/^notify(?: party)?\b/] },
  {
    field: "port_of_loading",
    patterns: [/^port of loading\b/, /^pol\b/, /^load(?:ing)? port\b/],
  },
  {
    field: "port_of_discharge",
    patterns: [/^port of discharge\b/, /^pod\b/, /^discharge port\b/],
  },
  {
    field: "container_count",
    patterns: [
      /^container count\b/,
      /^total containers?\b/,
      /^no\. of containers?(?: or packages)?\b/,
      /^containers\b/,
    ],
  },
  // Weightnn 是样例里存在的印刷变体，用 \w* 兼容
  { field: "gross_weight_kg", patterns: [/^(?:total\s+)?gross\s*(?:wt|weight)\w*/] },
];

// 值收集时的停止词：遇到"像下一节标题"的行就停
const STOP_LINE =
  /^(shipper|consignee|notify|port of|pol\b|pod\b|load(?:ing)? port|discharge port|container|total containers?|no\. of containers?|gross\s*(?:wt|weight)|vessel|ocean vessel|voyage|commodity|description|kinds of packages|hs code|booking|freight|export carrier|bill of lading|b\/l|order no|oc no|net weight|invoice|seller|buyer|date|tel\b|contact|documentation|shipment|delivery|goods)/i;

// 占位符/空值：出现这些就当没抽到（触发 missing_value 而不是当成"值"）
export const PLACEHOLDER_VALUE = /^[_\-\s.]*$|^(tba|n\/?a|null|—|-)$/i;

// 每个字段的值必须通过校验才采信（防止把表头/无关行当成值）
const VALUE_VALIDATORS: Partial<Record<ComparedField, (value: string) => boolean>> = {
  container_count: (value) => /^\d+(\s*x\s*.+)?$/i.test(value),
  gross_weight_kg: (value) => /^[\d,.\s]+\s*(kgs?|mts?)?\.?$/i.test(value),
};

export function parseDocumentFields(text: string): ExtractedDocumentFields {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/g, ""));
  const found: ExtractedDocumentFields = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const lower = line.normalize("NFKC").toLowerCase();

    for (const { field, patterns } of LABELS) {
      const hit = patterns.map((pattern) => lower.match(pattern)).find(Boolean);
      if (!hit) continue;

      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      let value = consumeLabel(line.slice(indent + hit[0].length));

      if (!value) {
        value = collectFollowingLines(lines, i, field);
      }

      const cleaned = value
        .replace(/\s+/g, " ")
        .replace(/^[\s:：;]+|[\s;]+$/g, "")
        .trim();
      const valid =
        Boolean(cleaned) &&
        !PLACEHOLDER_VALUE.test(cleaned) &&
        (VALUE_VALIDATORS[field]?.(cleaned) ?? true);
      if (valid) found[field] = cleaned;
      break; // 一行只认一个字段
    }
  }
  return found;
}

// 把标签后面紧贴的修饰（括号注释、毛重(KGS) 这类、/Intermediate Consignee 写法）剥掉
function consumeLabel(rest: string): string {
  let s = rest;
  for (let guard = 0; guard < 8; guard++) {
    const before = s;
    s = s.replace(/^\s*[\(（][^\)）]*[\)）]/, " ");
    s = s.replace(/^\s*毛重[^:：()]*/u, " ");
    s = s.replace(/^\s*\/?\s*intermediate consignee/i, " ");
    if (s === before) break;
  }
  return s.replace(/^[\s:：;]+/, "").trim();
}

// 值在标签下一行（docx/pdf 常见）：收集到下一节标题/分隔线/空行/上限为止
function collectFollowingLines(
  lines: string[],
  labelIndex: number,
  field: ComparedField
): string {
  const parts: string[] = [];
  // 公司名一般就在第一行，地址在随后的行；只取第一行避免把地址差异当公司名差异
  const maxLines = field === "shipper" || field === "consignee" || field === "notify_party" ? 1 : 3;

  for (let j = labelIndex + 1; j < lines.length; j++) {
    const next = lines[j];
    const nextLower = next.normalize("NFKC").toLowerCase();
    if (STOP_LINE.test(nextLower)) break;
    if (/^[=\-*#]{3,}/.test(next.trim())) break;
    if (!next.trim()) {
      if (parts.length) break;
      continue;
    }
    parts.push(next.trim());
    if (parts.length >= maxLines) break;
  }
  return parts.join(" ");
}

// 明显不是 SI/BL 的文档（样例里的 wrong_doc_type 陷阱：商业发票/装箱单/产地证）。
// 实现已挪到 lib/shared/document-identify.ts：import 模块识别上传文档时用的是同一份规则，
// 这里 re-export 保持现有调用方（extraction 内部）不变。
export { isLikelyOtherDocument } from "@/lib/shared/document-identify";
