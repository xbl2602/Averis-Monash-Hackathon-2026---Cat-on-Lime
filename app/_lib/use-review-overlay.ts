"use client";

import { useEffect, useState } from "react";
import type { ReviewOverride } from "@/lib/shared/review/types";
import { apiRequest, queryString } from "./api-client";

type OverlayModule = "comparison" | "classification";
const DECIDED_STATES = ["confirmed", "corrected", "deferred"] as const;

interface QueueResponse {
  items: { email_id: string; override: ReviewOverride | null }[];
}

/**
 * Every decision a person has made, gathered from the review queue's own endpoints (one call per module and state,
 * because the queue can only filter by one state at a time). This is what lets the results and conflicts screens show
 * a person's decision today, before the server puts `review` on each row. `modules` is in order of priority: when an
 * email was decided in more than one, the first module's decision is the one shown.
 *
 * It is decoration: if a call fails, the rows simply show no decision mark. The review queue itself is unaffected.
 */
async function fetchDecisions(modules: readonly OverlayModule[], signal: AbortSignal): Promise<Map<string, ReviewOverride>> {
  const decisions = new Map<string, ReviewOverride>();
  const calls = modules.flatMap((module) =>
    DECIDED_STATES.map(async (state) => {
      const url = `/features/${module}/api/review${queryString({ include_ok: true, review_state: state, limit: 200 })}`;
      const result = await apiRequest<QueueResponse>(url, { signal, cache: "no-store" });
      return result.ok ? result.data.items : [];
    })
  );
  const perCall = await Promise.all(calls);
  // Calls come back grouped by module in priority order, so the first override seen for an email wins
  for (const items of perCall) {
    for (const item of items) {
      if (item.override && !decisions.has(item.email_id)) decisions.set(item.email_id, item.override);
    }
  }
  return decisions;
}

/**
 * Look up the person's decision for a row. A row that carries its own `review` key (the server supports it) is
 * answered from that and nothing is fetched; pass `enabled: false` in that case so the extra calls never happen.
 */
export function useReviewOverlay({ enabled, modules }: { enabled: boolean; modules: readonly OverlayModule[] }) {
  const [decisions, setDecisions] = useState<Map<string, ReviewOverride>>(() => new Map());
  const moduleKey = modules.join(",");

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetchDecisions(moduleKey.split(",") as OverlayModule[], controller.signal).then((next) => {
      if (!controller.signal.aborted) setDecisions(next);
    });
    return () => controller.abort();
  }, [enabled, moduleKey]);

  return (row: { email_id: string; review?: ReviewOverride | null }): ReviewOverride | null =>
    "review" in row ? row.review ?? null : decisions.get(row.email_id) ?? null;
}
