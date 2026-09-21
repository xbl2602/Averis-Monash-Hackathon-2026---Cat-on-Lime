"use client";

import { useRef, useState, type DragEvent } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { LockedCard } from "../../../_components/admin/admin-gate";
import { Icon } from "../../../_components/icon";
import { Badge } from "../../../_components/results/badges";
import { useToast } from "../../../_components/toast";
import type { UploadItemResult, UploadResponse } from "../../../_lib/contracts";
import { fileToBase64, formatBytes } from "../../../_lib/format";
import { problemWith, splitIntoBatches, type QueuedFile } from "./batches";

type Outcome = { state: "waiting" } | { state: "sending" } | { state: "done"; result: UploadItemResult } | { state: "failed"; message: string };

let queueCounter = 0;
const toQueued = (files: File[]): QueuedFile[] => files.map((file) => ({ id: `q${++queueCounter}`, file, problem: problemWith(file) }));

function OutcomeBadge({ outcome, problem }: { outcome: Outcome | undefined; problem: string | null }) {
  if (problem) return <Badge tone="bad" icon="xCircle">{problem}</Badge>;
  if (!outcome || outcome.state === "waiting") return <Badge tone="muted" icon="clock">Waiting</Badge>;
  if (outcome.state === "sending") return <Badge tone="info" icon="upload">Sending…</Badge>;
  if (outcome.state === "failed") return <Badge tone="bad" icon="xCircle">{outcome.message}</Badge>;
  const r = outcome.result;
  if (r.status === "rejected") return <Badge tone="bad" icon="xCircle">{r.reason ?? "Rejected"}</Badge>;
  if (r.status === "duplicate") return <Badge tone="warn" icon="copy">Already in the pool</Badge>;
  return (
    <Badge tone={r.parse_status === "unreadable" ? "warn" : "ok"} icon={r.parse_status === "unreadable" ? "alert" : "checkCircle"}>
      Stored · {r.detected_type ?? "?"}
      {r.parse_status === "unreadable" ? " · unreadable" : ""}
    </Badge>
  );
}

/** Pick or drop files (or a whole folder), then send them in size-limited batches. Needs write access. */
export function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const { unlocked, adminRequest } = useAdmin();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendable = queue.filter((q) => !q.problem && outcomes[q.id]?.state !== "done");

  function add(files: File[]) {
    if (files.length > 0) setQueue((prev) => [...prev, ...toQueued(files)]);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setHover(false);
    add([...event.dataTransfer.files]);
  }

  async function send() {
    setBusy(true);
    const batchId = crypto.randomUUID();
    let stored = 0;
    for (const batch of splitIntoBatches(sendable)) {
      setOutcomes((prev) => ({ ...prev, ...Object.fromEntries(batch.map((q) => [q.id, { state: "sending" } as Outcome])) }));
      try {
        const files = await Promise.all(batch.map(async (q) => ({ name: q.file.name, mime: q.file.type || undefined, data_base64: await fileToBase64(q.file) })));
        const response = await adminRequest<UploadResponse>("/features/import/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files, batch_id: batchId }),
        });
        setOutcomes((prev) => {
          const next = { ...prev };
          batch.forEach((q, i) => {
            const item = response.ok ? response.data.items[i] : undefined;
            next[q.id] = item ? { state: "done", result: item } : { state: "failed", message: response.ok ? "No answer for this file" : response.error.message };
          });
          return next;
        });
        if (response.ok) stored += response.data.items.filter((i) => i.status === "stored").length;
        else if (response.status === 401 || response.status === 403) break; // locked again: stop, the rest stay queued
      } catch {
        setOutcomes((prev) => ({ ...prev, ...Object.fromEntries(batch.map((q) => [q.id, { state: "failed", message: "Could not read the file" } as Outcome])) }));
      }
    }
    setBusy(false);
    if (stored > 0) {
      toast({ tone: "ok", title: `${stored} ${stored === 1 ? "document" : "documents"} added to the pool` });
      onUploaded();
    }
  }

  return (
    <section className="card space-y-5 p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-royal text-white shadow-md">
          <Icon name="upload" size={24} />
        </span>
        <div>
          <h2 className="text-lg font-bold">Upload documents</h2>
          <p className="mt-0.5 text-sm text-fg-muted">Each file is checked, read and identified by its content, not its name. Duplicates are skipped.</p>
        </div>
      </div>

      {!unlocked && <LockedCard action="upload documents" />}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed p-8 text-center transition duration-300 ${hover ? "scale-[1.01] border-accent bg-accent/10" : "border-line-strong bg-sunken"}`}
      >
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong transition ${hover ? "-translate-y-2" : "animate-float"}`}>
          <Icon name="folder" size={28} />
        </span>
        <div className="text-sm font-semibold">Drop files here</div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-glass !py-2">
            <Icon name="file" size={16} />
            Choose files
          </button>
          <button type="button" onClick={() => folderInput.current?.click()} className="btn btn-glass !py-2">
            <Icon name="folder" size={16} />
            Choose a folder
          </button>
        </div>
        <p className="text-[11px] text-fg-faint">.txt .md .pdf .docx .xlsx · up to 3 MB each · sent in batches automatically</p>
        <input ref={fileInput} type="file" multiple accept=".txt,.md,.pdf,.docx,.xlsx" className="sr-only" tabIndex={-1} onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <input ref={folderInput} type="file" multiple className="sr-only" tabIndex={-1} {...({ webkitdirectory: "" } as object)} onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>

      {queue.length > 0 && (
        <div className="animate-rise space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">
              {queue.length} {queue.length === 1 ? "file" : "files"} · {formatBytes(queue.reduce((n, q) => n + q.file.size, 0))}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => { setQueue([]); setOutcomes({}); }} className="btn btn-glass !py-2">
                Clear
              </button>
              <button type="button" disabled={busy || !unlocked || sendable.length === 0} onClick={() => void send()} className="btn btn-primary btn-shine !py-2">
                <Icon name="upload" size={16} />
                {busy ? "Uploading…" : `Upload ${sendable.length}`}
              </button>
            </div>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {queue.map((q, i) => (
              <li key={q.id} style={{ "--i": Math.min(i, 8) } as React.CSSProperties} className="animate-rise stagger flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-sunken px-4 py-2.5">
                <Icon name="file" size={18} className="shrink-0 text-fg-faint" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{q.file.name}</div>
                  <div className="text-[11px] text-fg-faint">{formatBytes(q.file.size)}</div>
                </div>
                <OutcomeBadge outcome={outcomes[q.id]} problem={q.problem} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
