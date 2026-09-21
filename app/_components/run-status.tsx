"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ApiResult } from "../_lib/api-client";

/**
 * Long-running actions (a pipeline run, a retry, a database reset) used to live in the state of the
 * component that started them. Navigating away unmounted that component, so the run became invisible:
 * come back and the page looked untouched while the request was still in flight, and its result was
 * dropped on the floor. This keeps both the promise and the outcome here instead.
 *
 * Mounted in the ROOT providers on purpose, not in DashboardShell: /dashboard and /features are two
 * separate route trees that each render their own shell, so state held in the shell is thrown away
 * when you cross between them — which is exactly the case that broke.
 *
 * Scope: one browser tab, client-side navigation. A full page reload still loses it; tracking runs
 * across reloads would need the server to own the job, which is a bigger change than this is worth.
 */

export interface RunRecord<T = unknown> {
  running: boolean;
  /** Shown in the global indicator, e.g. "Full pipeline run". */
  label: string;
  /** Where the indicator sends you to watch it. */
  href: string;
  startedAt: number;
  finishedAt: number | null;
  /** The finished call. Null while it is still running. */
  result: ApiResult<T> | null;
}

interface RunStatusContextValue {
  records: Record<string, RunRecord>;
  start: <T>(key: string, options: { label: string; href: string; task: () => Promise<ApiResult<T>> }) => Promise<ApiResult<T> | null>;
  clear: (key: string) => void;
}

const RunStatusContext = createContext<RunStatusContextValue | null>(null);

export function RunStatusProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<Record<string, RunRecord>>({});

  const start = useCallback(
    async <T,>(key: string, options: { label: string; href: string; task: () => Promise<ApiResult<T>> }): Promise<ApiResult<T> | null> => {
      let alreadyRunning = false;
      setRecords((prev) => {
        if (prev[key]?.running) {
          alreadyRunning = true;
          return prev;
        }
        return {
          ...prev,
          [key]: { running: true, label: options.label, href: options.href, startedAt: Date.now(), finishedAt: null, result: null },
        };
      });
      // Refuse to start a second copy of the same action: these write to a shared database,
      // and a double click across two pages should not turn into two runs.
      if (alreadyRunning) return null;

      const result = await options.task();
      setRecords((prev) => ({
        ...prev,
        [key]: { ...prev[key], running: false, finishedAt: Date.now(), result: result as ApiResult<unknown> },
      }));
      return result;
    },
    []
  );

  const clear = useCallback((key: string) => {
    setRecords((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo(() => ({ records, start, clear }), [records, start, clear]);
  return <RunStatusContext.Provider value={value}>{children}</RunStatusContext.Provider>;
}

function useRunStatusContext(): RunStatusContextValue {
  const ctx = useContext(RunStatusContext);
  if (!ctx) throw new Error("useRunStatus must be used inside <RunStatusProvider>");
  return ctx;
}

/** One tracked action: its record (survives leaving the page) plus the way to start and forget it. */
export function useRunStatus<T>(key: string) {
  const { records, start, clear } = useRunStatusContext();
  const record = (records[key] as RunRecord<T> | undefined) ?? null;
  return {
    record,
    running: record?.running ?? false,
    result: record?.result ?? null,
    start: useCallback(
      (options: { label: string; href: string; task: () => Promise<ApiResult<T>> }) => start<T>(key, options),
      [start, key]
    ),
    clear: useCallback(() => clear(key), [clear, key]),
  };
}

/** Everything still in flight, for the indicator in the top bar. */
export function useRunningJobs(): RunRecord[] {
  const { records } = useRunStatusContext();
  return useMemo(() => Object.values(records).filter((r) => r.running), [records]);
}
