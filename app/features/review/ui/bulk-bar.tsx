"use client";

import { useState } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { Icon } from "../../../_components/icon";
import { DISPOSITION_LABELS, type ReviewDisposition } from "./review-api";

/** Appears when items are ticked: one action for all of them. Each item is processed on its own, so one bad item never blocks the rest. */
export function BulkBar({
  count,
  module,
  busy,
  onRun,
  onClear,
}: {
  count: number;
  module: string;
  busy: boolean;
  onRun: (action: "confirm" | "defer" | "disposition", disposition?: ReviewDisposition) => void;
  onClear: () => void;
}) {
  const { unlocked } = useAdmin();
  const [disposition, setDisposition] = useState<ReviewDisposition>("accepted");
  if (count === 0) return null;
  const off = busy || !unlocked;

  return (
    <div className="animate-slide-in card sticky bottom-4 z-20 flex flex-wrap items-center gap-3 !bg-surface-solid p-3 shadow-2xl sm:px-5" role="region" aria-label="Bulk actions">
      <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-accent px-2 text-sm font-bold text-white">{count}</span>
      <span className="text-sm font-semibold">selected</span>
      {!unlocked && <span className="text-xs text-fg-faint">Unlock write access to act on them.</span>}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {module !== "pipeline" && (
          <button type="button" disabled={off} onClick={() => onRun("confirm")} className="btn btn-primary btn-shine !py-2">
            <Icon name="checkCircle" size={16} />
            Confirm all
          </button>
        )}
        <button type="button" disabled={off} onClick={() => onRun("defer")} className="btn btn-glass !py-2">
          <Icon name="pause" size={16} />
          Set aside
        </button>
        {module !== "pipeline" && (
          <span className="flex items-center gap-2">
            <select value={disposition} onChange={(e) => setDisposition(e.target.value as ReviewDisposition)} aria-label="Destination for all" className="field !w-auto !py-2 !text-xs">
              {Object.entries(DISPOSITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" disabled={off} onClick={() => onRun("disposition", disposition)} className="btn btn-glass !py-2">
              <Icon name="target" size={16} />
              Apply
            </button>
          </span>
        )}
        <button type="button" onClick={onClear} aria-label="Clear selection" className="flex h-9 w-9 items-center justify-center rounded-full text-fg-faint transition hover:bg-sunken hover:text-fg">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}
