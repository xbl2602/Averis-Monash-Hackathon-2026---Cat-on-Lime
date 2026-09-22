/**
 * Database read layer for the results module.
 * Read-only: this module never writes verification_results (writing is the pipeline's/evaluate's job,
 * see the read/write boundary in DATA_FLOW.md).
 * "Paginate through the full set" and "sanitize search terms" are both handled here uniformly —
 * no other file should reimplement them.
 */
import { getSupabaseClient } from "@/lib/shared/supabase";
import { DataAccessError } from "./errors";

// PostgREST returns at most 1000 rows per call; paginate through when export/stats needs the full set
const PAGE_SIZE = 1000;

export function getReadClient() {
  try {
    return getSupabaseClient();
  } catch (err) {
    throw new DataAccessError(
      err instanceof Error ? err.message : "Failed to initialize the Supabase read-only client"
    );
  }
}

/** Fetch all matching rows page by page (at most 1000 per call, looping until exhausted) */
export async function fetchAllRows<T>(
  makePage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makePage(from, from + PAGE_SIZE - 1);
    if (error) throw new DataAccessError(`Failed to read from Supabase: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Sanitize keyword search terms to avoid introducing PostgREST filter syntax characters
 * (, ( ) " \) that would cause a parse error; this also strips the LIKE wildcards % _,
 * so search behaves as plain substring matching.
 */
export function sanitizeSearchTerm(value: string): string | null {
  const cleaned = value.replace(/[,()"\\%_]/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}

/** Build an ilike fragment for PostgREST's or() (the column name comes from this module's whitelist, not user input) */
export function ilikeFragment(column: string, term: string): string {
  return `${column}.ilike.%${term}%`;
}
