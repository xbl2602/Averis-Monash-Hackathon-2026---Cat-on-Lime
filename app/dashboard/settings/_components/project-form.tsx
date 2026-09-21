"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "../../../_components/icon";
import type { SupabaseProject } from "../../../_lib/contracts";

export interface ProjectDraft {
  id?: string;
  label: string;
  project_url: string;
  anon_key: string;
  service_key: string;
}

/**
 * Add or edit a Supabase project. Leaving the service key empty keeps the stored one (it is only ever shown masked);
 * typing a new value replaces it.
 */
export function ProjectForm({ project, busy, onSubmit, onCancel }: { project: SupabaseProject | null; busy: boolean; onSubmit: (draft: ProjectDraft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ProjectDraft>({
    id: project?.id,
    label: project?.label ?? "",
    project_url: project?.project_url ?? "",
    anon_key: project?.anon_key ?? "",
    service_key: "",
  });
  const valid = draft.label.trim() !== "" && /^https?:\/\//i.test(draft.project_url.trim());
  const set = (patch: Partial<ProjectDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSubmit({ ...draft, label: draft.label.trim(), project_url: draft.project_url.trim() });
  }

  return (
    <form onSubmit={submit} className="animate-pop space-y-4 rounded-2xl border border-accent/40 bg-accent/[0.06] p-5">
      <div className="text-sm font-bold">{project ? `Edit ${project.label}` : "Add a Supabase project"}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-semibold text-fg-muted">Name</span>
          <input value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Production" className="field" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-semibold text-fg-muted">Project URL</span>
          <input value={draft.project_url} onChange={(e) => set({ project_url: e.target.value })} placeholder="https://xxxx.supabase.co" inputMode="url" className="field font-mono !text-xs" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-semibold text-fg-muted">Anon (public) key</span>
          <input value={draft.anon_key} onChange={(e) => set({ anon_key: e.target.value })} placeholder="eyJ…" className="field font-mono !text-xs" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-xs font-semibold text-fg-muted">Service key</span>
          <input type="password" autoComplete="off" value={draft.service_key} onChange={(e) => set({ service_key: e.target.value })} placeholder={project?.has_service_key ? `${project.service_key ?? "••••••••"} (type to replace)` : "Paste the service-role key"} className="field font-mono !text-xs" />
        </label>
      </div>
      <p className="text-xs text-fg-faint">The service key is encrypted when saved and only ever shown masked. It gives full access, so paste it only on a server you trust.</p>
      <div className="flex gap-3">
        <button type="submit" disabled={busy || !valid} className="btn btn-primary btn-shine !py-2">
          <Icon name="save" size={16} />
          {busy ? "Saving…" : "Save project"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-glass !py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
