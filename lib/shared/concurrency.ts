/**
 * 批量处理时的并发控制工具（见 CLAUDE.md「高并发与数据同步/冲突处理」）。
 * 用于替代"一个个排队处理"（太慢）或"一次性全部并行"（容易把 LLM API 限流、
 * 把 Supabase 连接数打满）这两种极端做法。
 */

export interface ConcurrencyLimitOptions {
  /** 同一时间最多处理几个，默认 3 */
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
 * 对 items 逐一调用 fn，但同时最多只有 `concurrency` 个在跑。
 * 单个 item 处理失败不会中断其他 item——失败的会被收集进 failed，
 * 不会跟着抛出让整批调用者一起崩掉（对应"单条数据失败不能拖垮整批"的要求）。
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
