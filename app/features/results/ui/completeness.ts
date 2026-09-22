/** What the export's response headers say about how complete the file is (see SHARED_INTERFACES.md, "Export"). */
export interface Completeness {
  items: number;
  incomplete: boolean;
  /** "sample" = checked against the official list; "db-fallback" = the list was unreadable so the database count was used */
  expectedSource: string;
  missing: number;
  missingIds: string[];
  stale: number;
  staleIds: string[];
  invalid: number;
  invalidIds: string[];
  reviewPending: number;
  reviewDeferred: number;
}

function num(headers: Headers, name: string): number {
  const value = Number(headers.get(name));
  return Number.isFinite(value) ? value : 0;
}

function ids(headers: Headers, name: string): string[] {
  return (headers.get(name) ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function readCompleteness(headers: Headers): Completeness {
  return {
    items: num(headers, "X-Export-Items"),
    // The server is fail-closed: anything other than an explicit "false" counts as incomplete
    incomplete: headers.get("X-Export-Incomplete") !== "false",
    expectedSource: headers.get("X-Export-Expected-Source") ?? "",
    missing: num(headers, "X-Export-Missing"),
    missingIds: ids(headers, "X-Export-Missing-Ids"),
    stale: num(headers, "X-Export-Stale"),
    staleIds: ids(headers, "X-Export-Stale-Ids"),
    invalid: num(headers, "X-Export-Invalid"),
    invalidIds: ids(headers, "X-Export-Invalid-Ids"),
    reviewPending: num(headers, "X-Review-Pending"),
    reviewDeferred: num(headers, "X-Review-Deferred"),
  };
}
