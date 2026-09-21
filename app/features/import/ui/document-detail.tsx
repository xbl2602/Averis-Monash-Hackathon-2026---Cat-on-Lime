"use client";

import { useState } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { Icon } from "../../../_components/icon";
import { Skeleton } from "../../../_components/motion/skeleton";
import { LoadError } from "../../../_components/results/states";
import { useToast } from "../../../_components/toast";
import type { DetectedType, DocumentDetail } from "../../../_lib/contracts";
import { fullDate } from "../../../_lib/format";
import { useApi } from "../../../_lib/use-api";

const FILE_AS: { type: Exclude<DetectedType, "UNKNOWN">; label: string }[] = [
  { type: "SI", label: "Shipping Instruction" },
  { type: "BL", label: "Bill of Lading" },
  { type: "OTHER", label: "Something else" },
];

/** Opened under a document row: the text that was read from it, and buttons to file it as an SI, a BL or something else. */
export function DocumentDetailPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { data, error, loading, reload } = useApi<DocumentDetail>(`/features/import/api/documents/${id}`);
  const { unlocked, adminRequest } = useAdmin();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function fileAs(type: DetectedType) {
    if (!data) return;
    setBusy(type);
    const result = await adminRequest<unknown>("/features/import/api/documents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, detected_type: type, ...(data.updated_at ? { expected_updated_at: data.updated_at } : {}) }),
    });
    setBusy(null);
    if (result.ok) {
      toast({ tone: "ok", title: `Filed as ${type}` });
      reload();
      onChanged();
    } else if (result.status !== 401 && result.status !== 403) {
      toast({ tone: "bad", title: "Could not file it", detail: result.error.message });
    }
  }

  return (
    <div className="space-y-4 px-4 pb-5 pt-2 sm:px-6">
      {loading && !data && <Skeleton className="h-40 w-full" />}
      {error && <LoadError error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-fg-faint">
              Identified as <span className="font-semibold text-fg">{data.detected_type}</span> · uploaded by {data.uploaded_by ?? "unknown"} · {fullDate(data.updated_at)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-fg-muted">File as</span>
              {FILE_AS.map((option) => (
                <button key={option.type} type="button" disabled={!unlocked || busy !== null} onClick={() => void fileAs(option.type)} title={unlocked ? undefined : "Unlock write access first"} className={`btn !px-3.5 !py-1.5 !text-xs ${data.detected_type === option.type && data.review_status === "filed" ? "btn-primary" : "btn-glass"}`}>
                  {busy === option.type ? <Icon name="refresh" size={14} className="animate-spin" /> : <Icon name="folder" size={14} />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {data.parse_status === "unreadable" && <p className="rounded-xl bg-warn-soft p-3 text-xs text-warn">Could not read text from this file{data.parse_error ? `: ${data.parse_error}` : "."} Scanned documents need OCR, which is not supported.</p>}
          <div className="overflow-hidden rounded-2xl border border-line bg-code">
            <div className="border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-fg-faint">Text read from the file</div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">{data.extracted_text || "(no text)"}</pre>
          </div>
        </>
      )}
    </div>
  );
}
