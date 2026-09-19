/**
 * 比对前的"规范化"：把两侧的值统一成可比较的规范形式，减少纯格式差异造成的误报。
 * - 文字字段：忽略大小写/空白/全角半角，去掉公司名尾部的标点，只取 "|" 前的主体名
 * - 数字字段：重量取纯数字（千分位/单位差异不影响）；箱数去掉空格和引号
 * 注意：这只用于"比较"判断，不改动存库/展示用的原文（原文在 parsed_text / extracted_* 里）。
 */
import { normalizeText } from "@/lib/shared/normalize";
import type { ComparedField } from "@/lib/shared/types";

export function canonicalFieldValue(field: ComparedField, value: string): string {
  const normalized = normalizeText(value);

  switch (field) {
    case "gross_weight_kg": {
      const digits = normalized.replace(/[^\d]/g, "");
      return digits ? String(Number(digits)) : normalized;
    }
    case "container_count":
      return normalized.replace(/[\s'’"“”.]/g, "");
    case "shipper":
    case "consignee":
    case "notify_party": {
      const name = normalized.split("|")[0].replace(/[\s:;]+$/g, "");
      return name.replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
    }
    default:
      return normalized;
  }
}

// 数字类字段（规范化后不同就是不同，不进 Jev——Jev 不擅长数字比较）
export const NUMERIC_FIELDS: ReadonlySet<ComparedField> = new Set([
  "container_count",
  "gross_weight_kg",
]);
