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
   * 用哪种方式比对。不传 = 逐字符精确比较（不调用模型；缺省值是 gemini，
   * 但该路径根本不会走到模型，改成 gemini 只是让"缺省 provider"口径一致）。
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
  /**
   * rules = 规范化精确比（含"没有 Jev key"的保守路径）；
   * rules+jev = 文字字段的候选差异复核过 Jev；
   * rules-degraded = Jev 调用失败，候选差异按保守口径（全部计入不一致）处理、可一键重试
   */
  engine: "rules" | "rules+jev" | "rules-degraded";
}

// Jev 对每个字段返回"两边是否一致"的概率，低于这个值就算不一致（与分类的置信度阈值统一为 0.85，偏保守）。
// 样例数据实测：0.85 仍然 0 漏报 0 误报（真实差异最高 0.52、真实一致最低 0.88）；再往上（0.9）会开始误报，
// 所以 0.85 是上限值，不要随意上调。改动前先重跑阈值校准（scripts/evaluate.ts + DECISION_LOG 决策 22）。
const JEV_MISMATCH_THRESHOLD = 0.85;

export async function compareDocuments(
  input: CompareDocumentsInput
): Promise<CompareDocumentsResult> {
  // 缺省值只影响"非 jev"分支（精确比较，不走模型）；jev 分支单独处理
  const provider = input.provider ?? "gemini";
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

  const state = buildFlatFieldPairs(textCandidates, si, bl);
  const questions: Record<string, JevQuestion> = {};
  for (const field of textCandidates) {
    questions[field] = {
      type: "noul",
      instructions: `SI 和 BL 的 ${field} 指的是同一个东西吗？容忍大小写、空格、标点、表述顺序差异；如果指的对象/地点不同则不是。`,
      criteria: { true: "含义一致", false: "含义不同或无法确认一致" },
    };
  }

  // Jev 复核失败（网络/额度/格式异常）不再让整封邮件失败（2026-09-21 P1-5）：
  // 保守降级为"候选差异全部计入不一致"（和没有 Jev key 时的口径一致，宁多勿漏），
  // engine 标 rules-degraded 供一键重试筛选，失败原因只进服务端日志。
  let jevDefects: ComparedField[];
  let engine: HybridCompareResult["engine"] = "rules+jev";
  try {
    const { value } = await callWithCache({
      purpose: "field_equivalence",
      provider: "jev",
      model: process.env.JEV_MODEL || "jev-latest",
      request: { state, questions },
      execute: () => callJev(state, questions),
    });

    jevDefects = textCandidates.filter((field) => {
      const answer = value.answers[field];
      if (!answer || answer.type !== "noul") {
        throw new Error(`Jev 返回的比对结果格式异常：字段 ${field} 缺少 noul 答案`);
      }
      return answer.noul < JEV_MISMATCH_THRESHOLD;
    });
  } catch (err) {
    console.warn(
      `[comparison] Jev 复核失败，候选差异按保守口径处理（全部计为不一致）：${err instanceof Error ? err.message : err}`
    );
    jevDefects = textCandidates;
    engine = "rules-degraded";
  }

  const defect_fields = dedupe([...oneSidedDefects, ...numericDefects, ...jevDefects]);
  return buildResult(defect_fields, engine);
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

  const state = buildFlatFieldPairs(comparableFields, si, bl);

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

/**
 * 模型输入的扁平化契约（见 docs/DECISION_SPEC.md §4.2/§6）：
 * 发给 Jev 的只有"字段名 + SI 原值 + BL 原值"的单层数组；
 * 不发整份单据对象、不发解析文本、不发规范化后的值。
 */
interface FlatFieldPair {
  field: ComparedField;
  si_value: string | null;
  bl_value: string | null;
}

function buildFlatFieldPairs(
  fields: ComparedField[],
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): FlatFieldPair[] {
  return fields.map((field) => ({
    field,
    si_value: si[field] ?? null,
    bl_value: bl[field] ?? null,
  }));
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}
