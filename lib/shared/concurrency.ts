/**
 * Concurrency-control utility for batch processing (see the "High Concurrency & Data
 * Sync/Conflict Handling" section of CLAUDE.md).
 * Used in place of the two extremes of "process one at a time in a queue" (too slow) or
 * "run everything in parallel at once" (easily rate-limits the LLM API or exhausts Supabase's
 * connection pool).
 */

export interface ConcurrencyLimitOptions {
  /** Max number processed at the same time, defaults to 3 */
  concurrency?: number;
}

export interface ConcurrencyLimitResult<T, R> {
  item: T;
  result: R;
}

export interface ConcurrencyLimitError<T> {
  item: T;
  error: unknown;
}

export interface ConcurrencyLimitOutcome<T, R> {
  succeeded: ConcurrencyLimitResult<T, R>[];
  failed: ConcurrencyLimitError<T>[];
}

/**
 * Calls fn once for each item in items, but with at most `concurrency` running at the same time.
 * A single item failing doesn't interrupt the others — failures are collected into `failed`
 * instead of being thrown and crashing the whole batch of callers together (this satisfies
 * the requirement that "a single failed item must not take down the whole batch").
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options?: ConcurrencyLimitOptions
): Promise<ConcurrencyLimitOutcome<T, R>> {
  const concurrency = Math.max(1, options?.concurrency ?? 3);
  const succeeded: ConcurrencyLimitResult<T, R>[] = [];
  const failed: ConcurrencyLimitError<T>[] = [];

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];
      try {
        const result = await fn(item);
        succeeded.push({ item, result });
      } catch (error) {
        failed.push({ item, error });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);

  return { succeeded, failed };
}
