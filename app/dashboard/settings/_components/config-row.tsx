"use client";

import { useState } from "react";
import { Icon } from "../../../_components/icon";
import { Badge } from "../../../_components/results/badges";
import type { ConfigItem } from "../../../_lib/contracts";
import { relativeTime } from "../../../_lib/format";
import { CONFIG_META, fromDraft, kindOf, toDraft } from "./config-meta";
import { Switch } from "./switch";

const SOURCE: Record<ConfigItem["source"], { label: string; tone: "ok" | "info" | "muted" | "warn" }> = {
  db: { label: "Saved here", tone: "ok" },
  env: { label: "From the server", tone: "info" },
  default: { label: "Default", tone: "muted" },
  unset: { label: "Not set", tone: "warn" },
};

/** One setting: label, where its value comes from, an editor, and Save / Reset. Secrets are never shown, only replaced. */
export function ConfigRow({ item, canEdit, busy, onSave }: { item: ConfigItem; canEdit: boolean; busy: boolean; onSave: (item: ConfigItem, value: string | number | boolean | string[] | null) => Promise<void> }) {
  const kind = kindOf(item);
  const meta = CONFIG_META[item.key];
  const source = SOURCE[item.source];
  const [draft, setDraft] = useState(() => toDraft(item));
  const [flag, setFlag] = useState(item.value === true);
  const [invalid, setInvalid] = useState(false);

  const baseline = kind === "boolean" ? item.value === true : toDraft(item);
  const dirty = kind === "boolean" ? flag !== baseline : draft !== baseline;

  async function save() {
    const value = kind === "boolean" ? flag : fromDraft(kind, draft);
    if (value === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await onSave(item, value);
  }

  return (
    <div className="grid gap-3 py-5 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{meta?.label ?? item.key}</span>
          <Badge tone={source.tone} icon={item.source === "db" ? "checkCircle" : item.source === "env" ? "server" : item.source === "unset" ? "alert" : "clock"}>{source.label}</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">{meta?.hint ?? "Custom setting."}</p>
        <p className="mt-1 font-mono text-[10px] text-fg-faint">
          {item.key}
          {item.updated_at ? ` · saved ${relativeTime(item.updated_at)}` : ""}
        </p>
      </div>

      <div className="min-w-0 space-y-2">
        {kind === "boolean" ? (
          <Switch checked={flag} onChange={setFlag} label={meta?.label ?? item.key} disabled={!canEdit} />
        ) : (
          <input
            type={kind === "secret" ? "password" : kind === "number" ? "number" : "text"}
            step={kind === "number" ? "any" : undefined}
            autoComplete="off"
            value={draft}
            disabled={!canEdit}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            placeholder={kind === "secret" ? (item.has_value ? `${String(item.value ?? "••••••••")} (type to replace)` : "Paste a key") : "Not set"}
            aria-label={meta?.label ?? item.key}
            className={`field ${kind === "secret" || kind === "url" ? "font-mono !text-xs" : ""} ${invalid ? "!border-bad" : ""}`}
          />
        )}
        {invalid && <p role="alert" className="text-xs text-bad">{kind === "number" ? "Enter a number." : "Enter a value."}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!canEdit || busy || !dirty} onClick={() => void save()} className="btn btn-primary !px-4 !py-1.5 !text-xs">
            <Icon name="save" size={14} />
            Save
          </button>
          {item.source === "db" && (
            <button type="button" disabled={!canEdit || busy} onClick={() => void onSave(item, null)} className="btn btn-glass !px-4 !py-1.5 !text-xs" title="Remove the saved value and fall back to the server setting or default">
              <Icon name="undo" size={14} />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
