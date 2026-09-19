/**
 * 比对模块：
 * - compareDocuments：按 provider 单一入口（给 REST/MCP/界面用）
 * - compareDocumentsHybrid：流水线默认的混合模式——规范化后先精确比，
 *   有"文字字段对不上"时才把候选差异交给 Jev（一次问完，noul 判断"是不是同一个东西"）；
 *   数字字段直接由代码判定（Jev 不擅长数字，实测会把 "5 x 20'GP" vs "6 x 20'GP" 判成一样）。
 */
import { callJev, isJevAvailable, type JevQuestion, type LLMProvider } from "@/lib/llm";
import { callWithCache } from "@/lib/shared/llm-cache";
import {
  COMPARED_FIELDS,
  type ComparedField,
  type ExtractedDocumentFields,
  type ComparisonStatus,
  type ReviewReason,
} from "@/lib/shared/types";
import { canonicalFieldValue, NUMERIC_FIELDS } from "./canonical";

export interface CompareDocumentsInput {
  si: ExtractedDocumentFields;
  bl: ExtractedDocumentFields;
  /**
   * 用哪种方式比对。默认 claude（沿用原有的"逐字符精确比较"，不调用模型）。
   * 传 "jev" 时会让 Jev 逐字段判断两边是否指同一个东西。
   */
  provider?: LLMProvider;
}

export interface CompareDocumentsResult {
  status: ComparisonStatus;
  defect_fields: ComparedField[];
  has_defect: boolean;
  review_reason: ReviewReason | null;
}

export interface HybridCompareResult extends CompareDocumentsResult {
  /** rules = 规范化精确比；rules+jev = 文字字段的候选差异复核过 Jev */
  engine: "rules" | "rules+jev";
}

// Jev 对每个字段返回"两边是否一致"的概率，低于这个值就算不一致。
// 0.6 是用样例数据校准出来的：0.5 会漏掉一封（真实差异 0.52），0.55~0.8 之间 0 漏报 0 误报
// （真实差异最高 0.52，真实一致最低 0.88，中间是安全带）。改动前先重跑阈值校准。
const JEV_MISMATCH_THRESHOLD = 0.6;

export async function compareDocuments(
  input: CompareDocumentsInput
): Promise<CompareDocumentsResult> {
  const provider = input.provider ?? "claude";
  if (provider === "jev") {
    return compareWithJev(input.si, input.bl);
  }
  return compareByExactValue(input.si, input.bl);
}

/**
 * 混合比对（流水线用）：规范化 → 精确比 → 文字字段候选差异交 Jev 复核。
 * 没有 Jev key 时降级：文字候选差异直接算差异（偏保守，不会漏报）。
 */
export async function compareDocumentsHybrid(input: {
  si: ExtractedDocumentFields;
  bl: ExtractedDocumentFields;
}): Promise<HybridCompareResult> {
  const { si, bl } = input;

  // 一边有值一边没有：正常流程会先判 missing_value，这里防御性地按"不一致"处理
  const oneSidedDefects = COMPARED_FIELDS.filter(
    (field) => hasValue(si[field]) !== hasValue(bl[field])
  );

  const bothPresent = COMPARED_FIELDS.filter(
    (field) => hasValue(si[field]) && hasValue(bl[field])
  );
  const candidates = bothPresent.filter(
    (field) => canonicalFieldValue(field, si[field]!) !== canonicalFieldValue(field, bl[field]!)
  );

  const numericDefects = candidates.filter((field) => NUMERIC_FIELDS.has(field));
  const textCandidates = candidates.filter((field) => !NUMERIC_FIELDS.has(field));

  if (textCandidates.length === 0 || !isJevAvailable()) {
    const defect_fields = dedupe([...oneSidedDefects, ...candidates]);
    return buildResult(defect_fields, "rules");
  }

  const state = textCandidates.map((field) => ({
    field,
    si_value: si[field],
    bl_value: bl[field],
  }));
  const questions: Record<string, JevQuestion> = {};
  for (const field of textCandidates) {
    questions[field] = {
      type: "noul",
      instructions: `SI 和 BL 的 ${field} 指的是同一个东西吗？容忍大小写、空格、标点、表述顺序差异；如果指的对象/地点不同则不是。`,
      criteria: { true: "含义一致", false: "含义不同或无法确认一致" },
    };
  }

  const { value } = await callWithCache({
    purpose: "field_equivalence",
    provider: "jev",
    model: process.env.JEV_MODEL || "jev-latest",
    request: { state, questions },
    execute: () => callJev(state, questions),
  });

  const jevDefects = textCandidates.filter((field) => {
    const answer = value.answers[field];
    if (!answer || answer.type !== "noul") {
      throw new Error(`Jev 返回的比对结果格式异常：字段 ${field} 缺少 noul 答案`);
    }
    return answer.noul < JEV_MISMATCH_THRESHOLD;
  });

  const defect_fields = dedupe([...oneSidedDefects, ...numericDefects, ...jevDefects]);
  return buildResult(defect_fields, "rules+jev");
}

function buildResult(
  defect_fields: ComparedField[],
  engine: HybridCompareResult["engine"]
): HybridCompareResult {
  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
    engine,
  };
}

function dedupe(fields: ComparedField[]): ComparedField[] {
  return [...new Set(fields)];
}

// 原逻辑：逐字段完全相等才算 OK（格式差异会被误判为 defect，所以才有 Jev 这条路）
function compareByExactValue(
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): CompareDocumentsResult {
  const defect_fields = COMPARED_FIELDS.filter(
    (field) => (si[field] ?? "") !== (bl[field] ?? "")
  );

  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
  };
}

// 用 Jev 的 noul（是/否概率）逐字段判断，容忍格式差异但不放过真实不一致
async function compareWithJev(
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): Promise<CompareDocumentsResult> {
  const comparableFields = COMPARED_FIELDS.filter(
    (field) => hasValue(si[field]) || hasValue(bl[field])
  );

  // 两边都没抽到任何可比较的字段，不能当作"全部一致"，交给上层处理
  if (comparableFields.length === 0) {
    return {
      status: "NEEDS_REVIEW",
      defect_fields: [],
      has_defect: false,
      review_reason: "missing_value",
    };
  }

  const questions: Record<string, JevQuestion> = {};
  for (const field of comparableFields) {
    questions[field] = {
      type: "noul",
      instructions: `SI 和 BL 上的 ${field} 指的是同一个东西吗？`,
      criteria: {
        true: "完全相同，或只是格式/大小写/空格不同但含义一致",
        false: "含义不同，或有一边缺失、无法确认一致",
      },
    };
  }

  const state = comparableFields.map((field) => ({
    field,
    si_value: si[field] ?? null,
    bl_value: bl[field] ?? null,
  }));

  const { value } = await callWithCache({
    purpose: "field_equivalence",
    provider: "jev",
    model: process.env.JEV_MODEL || "jev-latest",
    request: { state, questions },
    execute: () => callJev(state, questions),
  });

  const defect_fields = comparableFields.filter((field) => {
    const answer = value.answers[field];
    if (!answer || answer.type !== "noul") {
      throw new Error(`Jev 返回的比对结果格式异常：字段 ${field} 缺少 noul 答案`);
    }
    return answer.noul < JEV_MISMATCH_THRESHOLD;
  });

  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
  };
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}
