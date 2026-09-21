/**
 * 人工复核闭环的数据访问层：review_overrides / review_actions 的读写，
 * 以及复核队列的查询（读 verification_overview + 按 target_kind 叠加 override）。
 *
 * 写入一律 upsert（冲突键 target_kind+email_id，见 CLAUDE.md「高并发」），
 * 不做"先查再插"。读用 anon key（三表读都对 anon 开放），写用 service role key。
 */
import { randomUUID } from "node:crypto";
import { getSupabaseClient, getSupabaseServiceClient } from "@/lib/shared/supabase";
import type { ComparedField, ComparisonStatus, EmailCategory, ReviewReason } from "@/lib/shared/types";
import { ReviewStoreUnavailableError } from "./errors";
import {
  type ReviewActionRow,
  type ReviewAuditActionType,
  type ReviewOverride,
  type ReviewQueueItem,
  type ReviewTargetKind,
} from "./types";

/**
 * 包一层 getSupabaseClient/getSupabaseServiceClient：没配置 Supabase 时统一抛
 * ReviewStoreUnavailableError（映射 503），而不是让原始的通用 Error 掉进
 * request-errors.ts 的"未知错误"兜底变成 500 + 不可读文案——results 模块的
 * `getReadClient()`（app/features/results/logic/db.ts）就是这个模式，这里对齐它，
 * 修正队友A在接 GUI 时发现的"没配数据库时，review 是 500，别的模块是 503"不一致。
 */
function getReadClient() {
  try {
    return getSupabaseClient();
  } catch (err) {
    throw new ReviewStoreUnavailableError(
      err instanceof Error ? err.message : "Supabase 只读客户端初始化失败"
    );
  }
}

function getWriteClient() {
  try {
    return getSupabaseServiceClient();
  } catch (err) {
    throw new ReviewStoreUnavailableError(
      err instanceof Error ? err.message : "Supabase 服务端客户端初始化失败"
    );
  }
}

// 队列一次最多取这么多行再在内存里筛选/分页（和 verification-store.ts 的 loadStoredVerificationRows
// 用同一个量级：样例数据 3288 行，一次读完比拼 SQL 过滤简单，量级也扛得住）
const OVERVIEW_FETCH_LIMIT = 5000;

interface OverviewQueueRow {
  email_id: string;
  subject: string | null;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[] | null;
  processing_status: "ok" | "failed" | "pending";
  model_provider: string | null;
  updated_at: string | null;
}

const OVERVIEW_COLUMNS =
  "email_id,subject,category,comparison_status,review_reason,defect_fields,processing_status,model_provider,updated_at";

/** 这一行是不是这个 target_kind 默认队列该看的"异常项"（D3：默认异常驱动） */
function isInDefaultQueue(targetKind: ReviewTargetKind, row: OverviewQueueRow): boolean {
  const provider = row.model_provider ?? "";
  switch (targetKind) {
    case "comparison":
      return row.comparison_status === "MISMATCH" || row.comparison_status === "NEEDS_REVIEW";
    case "extraction":
      return (
        row.comparison_status === "NEEDS_REVIEW" &&
        (row.review_reason === "missing_value" ||
          row.review_reason === "wrong_doc_type" ||
          row.review_reason === "unreadable")
      );
    case "classification":
      // 2026-09-22 修复：分类"置信度<0.85"现在会落库成 review_reason=low_confidence_classification
      // （见 lib/shared/pipeline.ts 的 applyClassificationConfidence），这里覆盖两种情况：
      // 全模型失败降级（provider 前缀 "degraded/"），以及 Jev 给了结果但没把握。
      // 注意：这次修复只对之后新跑的结果生效，旧数据要重新跑一遍流水线才会补上这个标记。
      return provider.startsWith("degraded/") || row.review_reason === "low_confidence_classification";
    case "pipeline":
      return row.processing_status === "failed" || provider.includes("degraded");
  }
}

export interface ListQueueOptions {
  includeOk?: boolean;
  q?: string;
  /** 按系统比对状态筛选（OK/MISMATCH/NEEDS_REVIEW） */
  status?: ComparisonStatus;
  /** 按系统复核原因筛选 */
  reason?: ReviewReason;
  /** 按人工覆盖的 review_state 筛选；传 "none" = 只看还没有任何人工覆盖的项 */
  reviewState?: "confirmed" | "corrected" | "deferred" | "none";
  limit?: number;
  offset?: number;
}

export async function listReviewQueue(
  targetKind: ReviewTargetKind,
  options: ListQueueOptions = {}
): Promise<{ total: number; items: ReviewQueueItem[] }> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("verification_overview")
    .select(OVERVIEW_COLUMNS)
    .limit(OVERVIEW_FETCH_LIMIT);
  if (error) throw new Error(`读取 verification_overview 失败：${error.message}`);

  const rows = (data ?? []) as OverviewQueueRow[];
  let filtered = rows.filter((row) => options.includeOk || isInDefaultQueue(targetKind, row));
  if (options.status) filtered = filtered.filter((row) => row.comparison_status === options.status);
  if (options.reason) filtered = filtered.filter((row) => row.review_reason === options.reason);
  const searched = options.q ? filtered.filter((row) => matchesSearch(row, options.q!)) : filtered;

  const overrides = await listOverrides(
    targetKind,
    searched.map((row) => row.email_id)
  );

  const byReviewState = options.reviewState
    ? searched.filter((row) => {
        const override = overrides.get(row.email_id) ?? null;
        return options.reviewState === "none"
          ? override === null
          : override?.review_state === options.reviewState;
      })
    : searched;

  const items = byReviewState.map((row) => toQueueItem(row, overrides.get(row.email_id) ?? null));
  const limit = options.limit ?? items.length;
  const offset = options.offset ?? 0;

  return { total: items.length, items: items.slice(offset, offset + limit) };
}

function matchesSearch(row: OverviewQueueRow, q: string): boolean {
  const term = q.toLowerCase();
  return row.email_id.toLowerCase().includes(term) || (row.subject ?? "").toLowerCase().includes(term);
}

function toQueueItem(row: OverviewQueueRow, override: ReviewOverride | null): ReviewQueueItem {
  return {
    email_id: row.email_id,
    subject: row.subject ?? "",
    category: row.category,
    comparison_status: row.comparison_status,
    review_reason: row.review_reason,
    defect_fields: row.defect_fields ?? [],
    processing_status: row.processing_status,
    model_provider: row.model_provider,
    override,
    last_action_at: override?.updated_at ?? null,
    updated_at: row.updated_at,
  };
}

/** 单条邮件在 verification_overview 里的原始行（rerun/merge 用得到分类等基础信息时复用这个） */
export async function getQueueItem(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewQueueItem | null> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("verification_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("email_id", emailId)
    .maybeSingle();
  if (error) throw new Error(`读取 verification_overview 失败：${error.message}`);
  if (!data) return null;
  const override = await getOverride(targetKind, emailId);
  return toQueueItem(data as OverviewQueueRow, override);
}

export async function getOverride(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewOverride | null> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("review_overrides")
    .select("*")
    .eq("target_kind", targetKind)
    .eq("email_id", emailId)
    .maybeSingle();
  if (error) throw new Error(`读取 review_overrides 失败：${error.message}`);
  return (data as ReviewOverride | null) ?? null;
}

/**
 * 按 target_kind 取回全部 override，再在内存里按 emailIds 过滤（如果传了的话）。
 *
 * 不用 `.in("email_id", emailIds)`：results 导出会传全量 520+ 个 email_id 进来，
 * PostgREST 把这么大一个数组拼进 URL 查询参数会超长直接 400（实测报 "Bad Request"）。
 * review_overrides 本来就只有"被人工处理过的那一小撮"，全量读一次再过滤，比拼超长 IN 列表安全，
 * 量级也稳（不会随邮件总数增长而变大，只随"人工处理过多少条"增长）。
 */
export async function listOverrides(
  targetKind: ReviewTargetKind,
  emailIds?: string[]
): Promise<Map<string, ReviewOverride>> {
  const map = new Map<string, ReviewOverride>();
  if (emailIds && emailIds.length === 0) return map;
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("review_overrides")
    .select("*")
    .eq("target_kind", targetKind);
  if (error) throw new Error(`读取 review_overrides 失败：${error.message}`);
  const wanted = emailIds ? new Set(emailIds) : null;
  for (const row of (data ?? []) as ReviewOverride[]) {
    if (wanted && !wanted.has(row.email_id)) continue;
    map.set(row.email_id, row);
  }
  return map;
}

/** upsert（冲突键 target_kind+email_id），不是"先查再插" */
export async function upsertOverride(
  row: Omit<ReviewOverride, "created_at" | "updated_at"> & { updated_at: string }
): Promise<ReviewOverride> {
  const supabase = getWriteClient();
  const { data, error } = await supabase
    .from("review_overrides")
    .upsert(row, { onConflict: "target_kind,email_id" })
    .select("*")
    .single();
  if (error) throw new Error(`写入 review_overrides 失败：${error.message}`);
  return data as ReviewOverride;
}

export async function deleteOverride(targetKind: ReviewTargetKind, emailId: string): Promise<void> {
  const supabase = getWriteClient();
  const { error } = await supabase
    .from("review_overrides")
    .delete()
    .eq("target_kind", targetKind)
    .eq("email_id", emailId);
  if (error) throw new Error(`删除 review_overrides 失败：${error.message}`);
}

export async function insertAction(
  row: Omit<ReviewActionRow, "id" | "created_at">
): Promise<ReviewActionRow> {
  const supabase = getWriteClient();
  const { data, error } = await supabase
    .from("review_actions")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`写入 review_actions 失败：${error.message}`);
  return data as ReviewActionRow;
}

export async function listActions(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewActionRow[]> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("review_actions")
    .select("*")
    .eq("target_kind", targetKind)
    .eq("email_id", emailId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`读取 review_actions 失败：${error.message}`);
  return (data ?? []) as ReviewActionRow[];
}

/** 最新一条"有效"动作（不是 undo、没被撤销过）：撤销默认目标 + 并发冲突判断都靠它 */
export async function getLatestEffectiveAction(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewActionRow | null> {
  const actions = await listActions(targetKind, emailId);
  const undoneIds = new Set(actions.filter((a) => a.undo_of !== null).map((a) => a.undo_of));
  return actions.find((a) => a.action_type !== "undo" && !undoneIds.has(a.id)) ?? null;
}

/** 最新一条指定类型的动作（undefer 找对应的 defer 时用） */
export async function getLatestActionOfType(
  targetKind: ReviewTargetKind,
  emailId: string,
  actionType: ReviewAuditActionType
): Promise<ReviewActionRow | null> {
  const actions = await listActions(targetKind, emailId);
  return actions.find((a) => a.action_type === actionType) ?? null;
}

export async function getActionById(
  targetKind: ReviewTargetKind,
  emailId: string,
  actionId: number
): Promise<ReviewActionRow | null> {
  const actions = await listActions(targetKind, emailId);
  return actions.find((a) => a.id === actionId) ?? null;
}

export function newBatchId(): string {
  return randomUUID();
}
