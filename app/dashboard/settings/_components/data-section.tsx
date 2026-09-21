"use client";

import { useState } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { LockedCard } from "../../../_components/admin/admin-gate";
import { Icon } from "../../../_components/icon";
import { Skeleton } from "../../../_components/motion/skeleton";
import { Notice } from "../../../_components/notice";
import { Badge } from "../../../_components/results/badges";
import { LoadError } from "../../../_components/results/states";
import { useToast } from "../../../_components/toast";
import type { SupabaseProject } from "../../../_lib/contracts";
import { relativeTime } from "../../../_lib/format";
import { useApi } from "../../../_lib/use-api";
import { ProjectForm, type ProjectDraft } from "./project-form";
import { SectionCard } from "./section-card";

const BASE = "/features/mail/api/supabase-projects";

/** The Supabase projects this server can use. Exactly one can be active; with none active it falls back to the server's environment. */
export function DataSection() {
  const { data, error, databaseDown, loading, reload } = useApi<{ items: SupabaseProject[] }>(BASE);
  const { unlocked, adminRequest } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupabaseProject | "new" | null>(null);

  async function call(key: string, url: string, body: unknown, success: string) {
    setBusy(key);
    const result = await adminRequest<unknown>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (result.ok) {
      toast({ tone: "ok", title: success });
      setEditing(null);
      reload();
    } else if (result.status !== 401 && result.status !== 403) {
      toast({ tone: "bad", title: "That did not work", detail: result.error.message });
    }
  }

  const save = (draft: ProjectDraft) =>
    call("save", BASE, { ...(draft.id ? { id: draft.id } : {}), label: draft.label, project_url: draft.project_url, anon_key: draft.anon_key, ...(draft.service_key ? { service_key: draft.service_key } : {}) }, "Project saved");

  const projects = data?.items ?? [];

  return (
    <SectionCard id="data" icon="database" title="Data sources" description="The Supabase projects this server can store results in. Only one is active at a time.">
      {databaseDown ? (
        <Notice tone="warn" title="No database is connected">
          Add <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> to the server environment (see .env.example), restart, and this list will appear.
        </Notice>
      ) : loading && !data ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : error || !data ? (
        <LoadError error={error ?? { message: "No projects came back." }} onRetry={reload} />
      ) : (
        <div className="space-y-5">
          <Notice tone="warn" title="Switching is not a live demo feature">
            Only the settings and mail data follow the active project. Results, the pipeline and uploads keep using the server&rsquo;s environment, so switching mid-demo would split your data across two places.
          </Notice>
          {!unlocked && <LockedCard action="add or switch projects" />}

          {projects.length === 0 && <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-fg-muted">No projects saved yet. The server uses its environment settings.</p>}

          <ul className="space-y-3">
            {projects.map((p, i) => (
              <li key={p.id} style={{ "--i": i } as React.CSSProperties} className={`animate-rise stagger rounded-2xl border p-4 transition ${p.is_active ? "border-ok/50 bg-ok-soft" : "border-line bg-sunken"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong">
                    <Icon name="database" size={22} />
                  </span>
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{p.label}</span>
                      {p.is_active && <Badge tone="ok" icon="checkCircle">Active</Badge>}
                    </div>
                    <div className="truncate font-mono text-[11px] text-fg-muted">{p.project_url}</div>
                    <div className="text-[11px] text-fg-faint">
                      Service key {p.has_service_key ? `saved (${p.service_key ?? "hidden"})` : "not set"} · updated {relativeTime(p.updated_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.is_active ? (
                      <button type="button" disabled={!unlocked || busy !== null} onClick={() => void call(p.id, `${BASE}/deactivate`, { id: p.id }, "Back to the server environment")} className="btn btn-glass !px-4 !py-1.5 !text-xs">
                        <Icon name="power" size={14} />
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" disabled={!unlocked || busy !== null} onClick={() => void call(p.id, `${BASE}/activate`, { id: p.id }, `${p.label} is now active`)} className="btn btn-primary !px-4 !py-1.5 !text-xs">
                        <Icon name="zap" size={14} />
                        Make active
                      </button>
                    )}
                    <button type="button" disabled={!unlocked || busy !== null} onClick={() => setEditing(p)} className="btn btn-glass !px-4 !py-1.5 !text-xs">
                      <Icon name="edit" size={14} />
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {editing ? (
            <ProjectForm key={editing === "new" ? "new" : editing.id} project={editing === "new" ? null : editing} busy={busy === "save"} onSubmit={(d) => void save(d)} onCancel={() => setEditing(null)} />
          ) : (
            <button type="button" disabled={!unlocked} onClick={() => setEditing("new")} className="btn btn-glass !py-2.5">
              <Icon name="plus" size={16} />
              Add a project
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
