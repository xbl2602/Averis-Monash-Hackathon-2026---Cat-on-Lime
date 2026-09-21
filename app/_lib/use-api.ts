"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiErrorInfo } from "../_components/api-error";
import { apiRequest } from "./api-client";

export interface ApiState<T> {
  /** Latest good response. Kept while a newer request is in flight so lists do not flash empty. */
  data: T | null;
  error: ApiErrorInfo | null;
  /** The server has no database connected (show the "connect your data" state, not a red error) */
  databaseDown: boolean;
  loading: boolean;
  reload: () => void;
}

/** GET a JSON endpoint and re-fetch when the URL changes. Pass null to stay idle. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [state, setState] = useState<Omit<ApiState<T>, "reload">>({
    data: null,
    error: null,
    databaseDown: false,
    loading: url !== null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true }));
    apiRequest<T>(url, { signal: controller.signal, cache: "no-store" }).then((result) => {
      if (result.ok) {
        setState({ data: result.data, error: null, databaseDown: false, loading: false });
      } else if (!result.aborted) {
        setState({ data: null, error: result.error, databaseDown: result.databaseDown, loading: false });
      }
    });
    return () => controller.abort();
  }, [url, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}
