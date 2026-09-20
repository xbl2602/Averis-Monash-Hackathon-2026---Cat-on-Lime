/**
 * uploaded_documents 表 + Storage(uploads bucket) 的读写层。
 *
 * 并发约定（SPEC 第 6 节）：
 * - 去重写入用 upsert + onConflict(file_hash) + ignoreDuplicates：
 *   并发上传同一个文件时由数据库保证只有一行，后到的请求拿到空结果，
 *   按 duplicate 返回；绝不"先查再插"，也不覆盖已有记录
 * - 读用 anon client（表对 anon 开放 select），写用 service client
 */
import { getSupabaseClient, getSupabaseServiceClient } from "@/lib/shared/supabase";
import { DocumentStoreError } from "./errors";
import {
  UPLOAD_BUCKET,
  type ClassifyDocumentRequest,
  type DocumentListQuery,
  type NewDocumentRow,
  type UpdateClassificationResult,
  type UploadedDocumentRow,
} from "./types";

function getReadClient() {
  try {
    return getSupabaseClient();
  } catch (err) {
    throw new DocumentStoreError(err instanceof Error ? err.message : "Supabase 只读客户端初始化失败");
  }
}

/** 去重预检：只看 id/detected_type，重复文件不需要再解析 */
export async function findDocumentByHash(
  fileHash: string
): Promise<Pick<UploadedDocumentRow, "id" | "detected_type"> | null> {
  const { data, error } = await getReadClient()
    .from("uploaded_documents")
    .select("id, detected_type")
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (error) throw new DocumentStoreError(`查询重复文档失败：${error.message}`);
  return data as Pick<UploadedDocumentRow, "id" | "detected_type"> | null;
}

/**
 * 插入文档记录。返回 null 表示文件哈希已存在（并发下别人先插入了）——
 * 调用方应返回 duplicate，而不是覆盖原记录。
 */
export async function insertDocumentRow(row: NewDocumentRow): Promise<UploadedDocumentRow | null> {
  const { data, error } = await getSupabaseServiceClient()
    .from("uploaded_documents")
    .upsert(row, { onConflict: "file_hash", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (error) throw new DocumentStoreError(`写入文档记录失败：${error.message}`);
  return (data as UploadedDocumentRow | null) ?? null;
}

/** 列表查询：返回匹配总数（total）和当前页行 */
export async function listDocumentRows(
  query: DocumentListQuery
): Promise<{ total: number; rows: UploadedDocumentRow[] }> {
  let request = getReadClient()
    .from("uploaded_documents")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);
  if (query.review_status) request = request.eq("review_status", query.review_status);
  if (query.detected_type) request = request.eq("detected_type", query.detected_type);

  const { data, error, count } = await request;
  if (error) throw new DocumentStoreError(`查询文档列表失败：${error.message}`);
  return { total: count ?? 0, rows: (data ?? []) as UploadedDocumentRow[] };
}

export async function getDocumentRowById(id: string): Promise<UploadedDocumentRow | null> {
  const { data, error } = await getReadClient()
    .from("uploaded_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new DocumentStoreError(`查询文档详情失败：${error.message}`);
  return (data as UploadedDocumentRow | null) ?? null;
}

/**
 * 人工归类：更新 detected_type 并把 review_status 置 filed。
 * 带 expected_updated_at 时用乐观锁；更新不到行再区分"不存在"和"被改过"。
 */
export async function updateDocumentClassification(
  request: ClassifyDocumentRequest
): Promise<UpdateClassificationResult> {
  let update = getSupabaseServiceClient()
    .from("uploaded_documents")
    .update({
      detected_type: request.detected_type,
      review_status: "filed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);
  if (request.expected_updated_at) {
    update = update.eq("updated_at", request.expected_updated_at);
  }

  const { data, error } = await update.select("*").maybeSingle();
  if (error) throw new DocumentStoreError(`更新文档归类失败：${error.message}`);
  if (data) return { status: "ok", row: data as UploadedDocumentRow };

  const existing = await getDocumentRowById(request.id);
  return existing ? { status: "conflict" } : { status: "not_found" };
}

/** 把原文件写进 Storage：路径按内容哈希生成，同一份内容重复写是幂等的（upsert） */
export async function uploadOriginalFile(
  storagePath: string,
  content: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await getSupabaseServiceClient()
    .storage.from(UPLOAD_BUCKET)
    .upload(storagePath, content, { contentType, upsert: true });
  if (error) throw new DocumentStoreError(`上传原文件到 Storage 失败：${error.message}`);
}

/** 补偿操作（落库失败时删掉刚上传的原文件）：尽力而为，失败只告警不抛错 */
export async function removeStoredFile(storagePath: string): Promise<void> {
  try {
    const { error } = await getSupabaseServiceClient()
      .storage.from(UPLOAD_BUCKET)
      .remove([storagePath]);
    if (error) {
      console.warn(`[import] 回滚删除 Storage 文件失败（${storagePath}）：${error.message}`);
    }
  } catch (err) {
    console.warn(`[import] 回滚删除 Storage 文件异常（${storagePath}）：`, err);
  }
}
