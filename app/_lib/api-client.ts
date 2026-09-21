import { describeApiError, describeNetworkError, isDatabaseUnavailable, type ApiErrorInfo } from "../_components/api-error";

/** Result of a request. Requests never throw: every failure comes back as a value the screen can show. */
export type ApiResult<T> =
  | { ok: true; status: number; data: T; headers: Headers }
  | { ok: false; status: number; error: ApiErrorInfo; databaseDown: boolean; aborted: boolean };

export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: describeApiError(res.status, body),
        databaseDown: isDatabaseUnavailable(res.status, body),
        aborted: false,
      };
    }
    return { ok: true, status: res.status, data: body as T, headers: res.headers };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return { ok: false, status: 0, error: describeNetworkError(), databaseDown: false, aborted };
  }
}

/** A downloaded file's text plus the headers that describe it. */
export type FileResult =
  | { ok: true; text: string; headers: Headers; filename: string }
  | { ok: false; status: number; error: ApiErrorInfo; databaseDown: boolean };

/**
 * GET a file (export). Uses fetch + text instead of a plain link because the export's completeness
 * report is in the response headers, and a browser download does not expose those.
 */
export async function fetchFile(url: string): Promise<FileResult> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      return { ok: false, status: res.status, error: describeApiError(res.status, body), databaseDown: isDatabaseUnavailable(res.status, body) };
    }
    const text = await res.text();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? "export.txt";
    return { ok: true, text, headers: res.headers, filename };
  } catch {
    return { ok: false, status: 0, error: describeNetworkError(), databaseDown: false };
  }
}

/** POST a JSON body. */
export function postJson<T>(url: string, body: unknown, init: RequestInit = {}): Promise<ApiResult<T>> {
  return apiRequest<T>(url, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) },
    body: JSON.stringify(body),
  });
}

/** Build "?a=1&b=2" from a params object, skipping empty values. Arrays become comma lists. */
export function queryString(params: Record<string, string | number | boolean | string[] | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "" || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
