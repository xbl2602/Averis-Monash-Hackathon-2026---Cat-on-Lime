"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { LockedCard } from "../../../_components/admin/admin-gate";
import { Notice } from "../../../_components/notice";
import { Skeleton } from "../../../_components/motion/skeleton";
import { LoadError } from "../../../_components/results/states";
import { useToast } from "../../../_components/toast";
import type { ConfigItem } from "../../../_lib/contracts";
import { useApi } from "../../../_lib/use-api";
import { CATEGORY_LABELS } from "./config-meta";
import { ConfigRow } from "./config-row";
import { ConnectionTests } from "./connection-tests";
import { SectionCard } from "./section-card";

type Value = string | number | boolean | string[] | null;

/** The runtime configuration center: every setting with where its value comes from, editable once write access is on. */
export function ConfigSection() {
  const { data, error, databaseDown, loading, reload } = useApi<{ items: ConfigItem[] }>("/features/config/api");
  const { unlocked, adminRequest } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<ConfigItem["category"]>("llm");

  const grouped = useMemo(() => {
    const groups = new Map<ConfigItem["category"], ConfigItem[]>();
    for (const item of data?.items ?? []) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    return groups;
  }, [data]);
  const categories = [...grouped.keys()];
  const shown = grouped.get(grouped.has(category) ? category : (categories[0] ?? "llm")) ?? [];

  async function save(item: ConfigItem, value: Value) {
    setBusy(true);
    const result = await adminRequest<unknown>("/features/config/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ key: item.key, value, ...(item.updated_at ? { expected_updated_at: item.updated_at } : {}) }] }),
    });
    setBusy(false);
    if (result.ok) {
      toast({ tone: "ok", title: value === null ? "Setting reset" : "Setting saved" });
      reload();
    } else if (result.status === 409) {
      toast({ tone: "warn", title: "Someone else changed this setting", detail: "The latest values were loaded. Check them and save again." });
      reload();
    } else if (result.status !== 401 && result.status !== 403) {
      toast({ tone: "bad", title: "Could not save", detail: result.error.message });
    }
  }

  return (
    <SectionCard id="config" icon="sliders" title="Configuration" description="Runtime settings, model keys and limits. Secret values are encrypted and are never shown again after saving.">
      {databaseDown ? (
        <Notice tone="warn" title="No database is connected">Settings are stored in Supabase. Add the project URL and key to the server environment first, then reload this page.</Notice>
      ) : loading && !data ? (
        <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : error || !data ? (
        <LoadError error={error ?? { message: "No settings came back." }} onRetry={reload} />
      ) : (
        <div className="space-y-7 !divide-y-0">
          <Notice title="What saving does today">
            Values are stored safely and shown here. The running engine still takes model keys from the server&rsquo;s environment, so use <strong>Test a connection</strong> below to check that a key works.
          </Notice>
          {!unlocked && <LockedCard action="change settings" />}

          <div role="tablist" aria-label="Setting groups" className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button key={c} role="tab" aria-selected={c === (grouped.has(category) ? category : categories[0])} type="button" onClick={() => setCategory(c)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition active:scale-95 ${c === (grouped.has(category) ? category : categories[0]) ? "border-accent bg-accent/15" : "border-line bg-sunken text-fg-muted hover:border-line-strong"}`}>
                {CATEGORY_LABELS[c]} <span className="ml-1 font-mono text-fg-faint">{grouped.get(c)?.length}</span>
              </button>
            ))}
          </div>

          <div key={category} className="animate-rise divide-y divide-line">
            {shown.map((item) => (
              <ConfigRow key={`${item.key}:${item.updated_at ?? "none"}`} item={item} canEdit={unlocked} busy={busy} onSave={save} />
            ))}
          </div>

          <ConnectionTests />
        </div>
      )}
    </SectionCard>
  );
}
