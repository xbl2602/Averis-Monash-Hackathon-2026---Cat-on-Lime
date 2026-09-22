"use client";

import { useCallback, useEffect, useState } from "react";
import { LockedCard } from "../../../_components/admin/admin-gate";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { Icon } from "../../../_components/icon";
import { Skeleton } from "../../../_components/motion/skeleton";
import { useToast } from "../../../_components/toast";
// Only the pure-constants file, never the logic/ barrel: the barrel also exports
// wipe.ts/restore.ts/status.ts, which pull in the Supabase server client and node:crypto —
// those must never end up in a client bundle.
import {
  DEVMODE_DATA_TABLES,
  RESTORE_CONFIRM_PHRASE,
  WIPE_CONFIRM_PHRASE,
  type DevModeDataTable,
  type DevModeStatusResponse,
} from "../logic/types";
import { DangerAction } from "./danger-action";

const TABLE_LABELS: Record<DevModeDataTable, string> = {
  raw_emails: "Raw emails",
  parsed_attachments: "Parsed attachments",
  verification_results: "Verification results",
  review_overrides: "Review overrides",
  review_actions: "Review action log",
  uploaded_documents: "Uploaded documents",
  llm_call_cache: "LLM call cache",
};

/** The persistent warning strip. Always rendered, no dismiss button, on purpose. */
function DevModeBanner() {
  return (
    <div role="alert" className="rounded-2xl border-2 border-bad bg-bad-soft p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Icon name="alert" size={24} className="mt-0.5 shrink-0 text-bad" />
        <div className="min-w-0 text-sm">
          <div className="font-bold text-bad">Developer mode — not a product feature</div>
          {/* Same warning as logic/types.ts DEVMODE_WARNING, in English: the product is English-only,
              and user-facing wording belongs in the UI layer. Keep the two in step if either changes. */}
          <p className="mt-1 leading-relaxed text-fg-muted">
            For the team and the judges during testing only. Everything here changes the shared database directly and cannot be undone. Do not use it unless you are sure what it does.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusTable({ status, onRefresh, refreshing }: { status: DevModeStatusResponse | null; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Row counts right now</h2>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="btn btn-glass !px-3 !py-1.5 !text-xs">
          <Icon name="refresh" size={14} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!status ? (
        <div className="mt-4 space-y-2">{DEVMODE_DATA_TABLES.map((t) => <Skeleton key={t} className="h-10" />)}</div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {status.tables.map((t) => (
            <li key={t.table} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="font-mono text-xs text-fg-muted">{t.table}</span>
              <span className="text-fg-muted">{TABLE_LABELS[t.table]}</span>
              <span className="font-mono font-semibold">{t.rowCount === null ? "—" : t.rowCount.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-fg-faint">
        Not included on purpose: <span className="font-mono">{status?.excludedTables.join(", ") ?? "app_config, mail_accounts, supabase_projects"}</span> — connection settings, not verification data.
      </p>
    </div>
  );
}

export function DevModeWorkspace() {
  const { unlocked, adminRequest } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<DevModeStatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<"wipe" | "restore" | null>(null);

  const loadStatus = useCallback(async () => {
    setRefreshing(true);
    const result = await adminRequest<DevModeStatusResponse>("/features/devmode/api");
    setRefreshing(false);
    if (result.ok) setStatus(result.data);
    else if (result.status !== 401 && result.status !== 403) {
      toast({ tone: "bad", title: "Could not read table status", detail: result.error.message });
    }
  }, [adminRequest, toast]);

  useEffect(() => {
    if (unlocked) void loadStatus();
  }, [unlocked, loadStatus]);

  async function runAction(kind: "wipe" | "restore") {
    const path = kind === "wipe" ? "/features/devmode/api/wipe" : "/features/devmode/api/restore";
    const confirm = kind === "wipe" ? WIPE_CONFIRM_PHRASE : RESTORE_CONFIRM_PHRASE;
    setBusy(kind);
    const result = await adminRequest<unknown>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    setBusy(null);
    if (result.ok) {
      toast({
        tone: "ok",
        title: kind === "wipe" ? "All tables cleared" : "Restored to the official sample",
      });
      void loadStatus();
    } else if (result.status !== 401 && result.status !== 403) {
      toast({ tone: "bad", title: "That did not work", detail: result.error.message });
    }
  }

  return (
    <div className="space-y-6">
      <DevModeBanner />

      {!unlocked ? (
        <LockedCard action="use developer mode" />
      ) : (
        <>
          <StatusTable status={status} onRefresh={() => void loadStatus()} refreshing={refreshing} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DangerAction
              icon="trash"
              title="Wipe all data"
              description="Deletes every row in the seven tables above, in dependency order. There is no undo and no backup — review notes and action history are gone for good."
              confirmPhrase={WIPE_CONFIRM_PHRASE}
              actionLabel="Wipe all data"
              busy={busy === "wipe"}
              onConfirm={() => void runAction("wipe")}
            />
            <DangerAction
              icon="refresh"
              title="Restore the official sample"
              description="Wipes everything, then re-imports the official sample emails and attachments from data/sample/. Verification results come back empty — run the pipeline again afterwards to fill them in."
              confirmPhrase={RESTORE_CONFIRM_PHRASE}
              actionLabel="Restore sample data"
              busy={busy === "restore"}
              onConfirm={() => void runAction("restore")}
            />
          </div>
        </>
      )}
    </div>
  );
}
