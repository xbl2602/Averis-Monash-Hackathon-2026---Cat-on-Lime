/**
 * results 模块的数据库读取层。
 * 只读：本模块不写 verification_results（写是流水线/evaluate 的事，见 DATA_FLOW.md 读写边界）。
 * 统一在这里处理"分页拉全量"和"搜索词净化"，别的文件不要再写一份。
 */
import { getSupabaseClient } from "@/lib/shared/supabase";
import { DataAccessError } from "./errors";

// PostgREST 单次最多返回 1000 行；导出/统计需要全量时分页拉取
const PAGE_SIZE = 1000;

export function getReadClient() {
  try {
    return getSupabaseClient();
  } catch (err) {
    throw new DataAccessError(
      err instanceof Error ? err.message : "Supabase 只读客户端初始化失败"
    );
  }
}

/** 按页拉取全部匹配行（最多一次 1000，循环直到取完） */
export async function fetchAllRows<T>(
  makePage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makePage(from, from + PAGE_SIZE - 1);
    if (error) throw new DataAccessError(`读取 Supabase 失败：${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * 净化关键词搜索词，避免把 PostgREST 的过滤语法字符（, ( ) " \）带进去导致解析错误。
 * 不在这里处理 LIKE 通配符 % _——那两个字符要留给 ilikeFragment 转义成字面量，
 * 不能在这里直接删掉：邮件 ID 全是 email_001 这种带下划线的格式，之前把 _ 也一起过滤掉，
 * 导致搜索 "email_065" 之类精确 ID 时下划线被替换成空格、永远匹配不上（真 bug，已修）。
 */
export function sanitizeSearchTerm(value: string): string | null {
  const cleaned = value.replace(/[,()"\\]/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}

/**
 * 拼 PostgREST or() 里的 ilike 片段（列名来自本模块白名单，不是用户输入）。
 * % 和 _ 是 LIKE 的通配符，用户搜索词里出现的话要转义成字面量，否则 "_" 会匹配任意单字符——
 * 邮件 ID 全是 email_001 这种带下划线的格式，不转义就没法精确搜索。
 */
export function ilikeFragment(column: string, term: string): string {
  const escaped = term.replace(/[%_]/g, (ch) => `\\${ch}`);
  return `${column}.ilike.%${escaped}%`;
}
