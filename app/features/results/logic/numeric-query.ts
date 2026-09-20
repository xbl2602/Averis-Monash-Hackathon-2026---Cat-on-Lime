/**
 * 冲突搜索的"数值口径"（2026-09-21 P1-6，见 DECISION_LOG 决策 28）。
 *
 * 只服务"查询/筛选"这一层，两个能力：
 * ① 模糊口径（numeric_mode=fuzzy）：两侧差值在容差内的数字字段不算冲突（吸收换算/四舍五入尾差）；
 * ② 按值搜索（value_field + value）：找 SI/BL 任一侧等于（精确）或≈（模糊+容差）输入值的冲突对。
 *
 * 重要边界：官方提交路径永远保持精确比对（comparison 模块负责，不含容差——
 * 官方缺陷注入的重量差是 ±500~2000kg，容差会得不偿失；依据见 docs/FINALS_ROADMAP.md 3.5/4.4）。
 * 本文件是纯函数，不碰数据库；由 conflicts.ts 在取回行之后套用。
 */
import { NUMERIC_SEARCH_FIELDS, type ConflictPair, type ConflictQuery, type NumericSearchField } from "./types";

export function usesNumericFeatures(query: ConflictQuery): boolean {
  return query.numericMode === "fuzzy" || query.valueField !== null;
}

/**
 * 按查询口径处理一条冲突对；返回 null 表示这条在模糊口径下"不再算冲突"（从结果里去掉）。
 * 只有"删除数字缺陷字段"和"按值过滤"两件事；其余字段照抄存储值，不改状态语义。
 */
export function applyNumericQuery(pair: ConflictPair, query: ConflictQuery): ConflictPair | null {
  let defectFields = pair.defect_fields;

  if (query.numericMode === "fuzzy") {
    defectFields = defectFields.filter(
      (field) =>
        !(
          isNumericField(field) &&
          withinTolerance(field, pair.si_values[field], pair.bl_values[field], query.tolerance)
        )
    );
    // 小尾差被吸收后没有别的缺陷了：MISMATCH 不再是冲突；NEEDS_REVIEW 保持原样（不确定≠差异）
    if (pair.status === "MISMATCH" && defectFields.length === 0) return null;
  }

  if (query.valueField !== null && query.value !== null) {
    const target = Number(query.value);
    const tolerance =
      query.numericMode === "fuzzy"
        ? toleranceFor(query.valueField, null, null, query.tolerance)
        : 0;
    if (!eitherSideMatches(pair, query.valueField, target, tolerance)) return null;
  }

  if (defectFields === pair.defect_fields) return pair;
  return { ...pair, defect_fields: defectFields, defect_count: defectFields.length };
}

export function isNumericField(field: string): field is NumericSearchField {
  return (NUMERIC_SEARCH_FIELDS as readonly string[]).includes(field);
}

/** 取出字段里的数字：重量取第一个数字（含小数）；箱数取开头数字（"3 x 40'GP" → 3） */
export function parseFieldNumber(
  field: NumericSearchField,
  value: string | undefined
): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, "");
  if (field === "gross_weight_kg") {
    const match = cleaned.match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  const match = cleaned.match(/^\D*(\d+)/);
  return match ? Number(match[1]) : null;
}

/** 容差：用户给了就用用户的；没给用默认（重量 max(0.5kg, 0.1%)，箱数 0） */
export function toleranceFor(
  field: NumericSearchField,
  a: number | null,
  b: number | null,
  userTolerance: number | null
): number {
  if (userTolerance !== null) return userTolerance;
  if (field === "gross_weight_kg") {
    const basis = Math.max(a ?? 0, b ?? 0);
    return Math.max(0.5, basis * 0.001);
  }
  return 0;
}

function withinTolerance(
  field: NumericSearchField,
  siValue: string | undefined,
  blValue: string | undefined,
  userTolerance: number | null
): boolean {
  const a = parseFieldNumber(field, siValue);
  const b = parseFieldNumber(field, blValue);
  if (a === null || b === null) return false; // 解析不了就不吸收，保持原判
  return Math.abs(a - b) <= toleranceFor(field, a, b, userTolerance) + Number.EPSILON;
}

function eitherSideMatches(
  pair: ConflictPair,
  field: NumericSearchField,
  target: number,
  tolerance: number
): boolean {
  for (const value of [pair.si_values[field], pair.bl_values[field]]) {
    const parsed = parseFieldNumber(field, value);
    if (parsed !== null && Math.abs(parsed - target) <= tolerance + Number.EPSILON) return true;
  }
  return false;
}
