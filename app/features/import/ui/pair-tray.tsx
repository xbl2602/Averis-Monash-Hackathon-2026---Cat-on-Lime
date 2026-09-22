"use client";

import { Icon } from "../../../_components/icon";
import type { DocumentListItem } from "../../../_lib/contracts";
import type { Pair } from "./use-pair-check";

function Slot({ label, doc }: { label: string; doc: DocumentListItem | null }) {
  return (
    <div className={`min-w-0 flex-1 basis-40 rounded-2xl border px-3.5 py-2.5 transition ${doc ? "border-accent/50 bg-accent/[0.07]" : "border-dashed border-line-strong bg-sunken"}`}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-fg-faint">{label}</div>
      <div className={`mt-0.5 truncate text-sm ${doc ? "font-semibold" : "text-fg-faint"}`}>{doc ? doc.file_name : "Choose one below"}</div>
    </div>
  );
}

/**
 * The pair being assembled. It stays at the bottom of the screen while you pick documents in the list above, and
 * the check is one button once both slots are filled.
 */
export function PairTray({ pair, busy, onCheck, onSwap, onClear }: { pair: Pair; busy: boolean; onCheck: () => void; onSwap: () => void; onClear: () => void }) {
  if (!pair.si && !pair.bl) return null;
  const ready = pair.si !== null && pair.bl !== null;

  return (
    <div role="region" aria-label="Documents chosen for a pair check" className="animate-slide-in card sticky bottom-4 z-20 flex flex-wrap items-center gap-3 !bg-surface-solid p-3 shadow-2xl sm:p-4">
      <Slot label="SI (reference)" doc={pair.si} />
      <button type="button" onClick={onSwap} disabled={!ready} aria-label="Swap the SI and the BL" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-fg-muted transition hover:border-line-strong hover:text-fg disabled:opacity-30">
        <Icon name="swap" size={16} />
      </button>
      <Slot label="Draft BL" doc={pair.bl} />

      <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <button type="button" onClick={onClear} className="btn btn-glass !py-2.5">
          Clear
        </button>
        <button type="button" onClick={onCheck} disabled={!ready || busy} className="btn btn-primary btn-shine !px-6 !py-2.5">
          <Icon name={busy ? "refresh" : "play"} size={16} className={busy ? "animate-spin" : ""} />
          {busy ? "Checking…" : ready ? "Check this pair" : "Pick both to check"}
        </button>
      </div>
    </div>
  );
}
