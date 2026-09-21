"use client";

import { useState } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { Icon } from "../../../_components/icon";
import { Badge } from "../../../_components/results/badges";
import { TEST_TARGETS } from "./config-meta";

type Outcome = { state: "running" } | { state: "done"; ok: boolean; detail: string };

/** "Does this key actually work?": the server decrypts the saved (or environment) key and makes one real call. */
export function ConnectionTests() {
  const { unlocked, adminRequest } = useAdmin();
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  async function test(target: string) {
    setOutcomes((prev) => ({ ...prev, [target]: { state: "running" } }));
    const result = await adminRequest<{ ok: boolean; detail: string }>("/features/config/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    setOutcomes((prev) => ({ ...prev, [target]: result.ok ? { state: "done", ok: result.data.ok, detail: result.data.detail } : { state: "done", ok: false, detail: result.error.message } }));
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold">Test a connection</h3>
        <p className="mt-0.5 text-xs text-fg-muted">Makes one small real request with the key in use, so you know it works before a demo.{unlocked ? "" : " Needs write access."}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {TEST_TARGETS.map(({ target, label }) => {
          const outcome = outcomes[target];
          return (
            <li key={target} className="rounded-2xl border border-line bg-sunken p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{label}</span>
                <button type="button" disabled={!unlocked || outcome?.state === "running"} onClick={() => void test(target)} className="btn btn-glass !px-3.5 !py-1.5 !text-xs">
                  <Icon name={outcome?.state === "running" ? "refresh" : "zap"} size={14} className={outcome?.state === "running" ? "animate-spin" : ""} />
                  {outcome?.state === "running" ? "Testing…" : "Test"}
                </button>
              </div>
              {outcome?.state === "done" && (
                <div className="animate-pop mt-2.5 space-y-1.5">
                  <Badge tone={outcome.ok ? "ok" : "bad"}>{outcome.ok ? "Working" : "Not working"}</Badge>
                  <p className="break-words text-[11px] leading-snug text-fg-muted">{outcome.detail}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
