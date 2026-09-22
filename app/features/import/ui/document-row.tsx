"use client";

import { Icon } from "../../../_components/icon";
import { Badge } from "../../../_components/results/badges";
import type { DocumentListItem } from "../../../_lib/contracts";
import { formatBytes, relativeTime } from "../../../_lib/format";
import { DocumentDetailPanel } from "./document-detail";

const TYPE_TONE = { SI: "info", BL: "info", OTHER: "muted", UNKNOWN: "warn" } as const;

export type Slot = "si" | "bl";

/** One button that puts this document into the SI or BL slot of the pair being checked. */
function SlotButton({ slot, doc, active, onPick }: { slot: Slot; doc: DocumentListItem; active: boolean; onPick: () => void }) {
  const unreadable = doc.parse_status === "unreadable";
  // A document the system already recognised as an SI (or BL) gets a gentle nudge towards that slot
  const suggested = !active && doc.detected_type === slot.toUpperCase();
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={unreadable}
      aria-pressed={active}
      title={unreadable ? "No text could be read from this file, so it cannot be checked" : active ? `Remove from the ${slot.toUpperCase()} slot` : `Use as the ${slot.toUpperCase()}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-accent bg-accent text-white shadow-md" : suggested ? "border-accent/60 bg-accent/10 text-fg" : "border-line bg-sunken text-fg-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      <Icon name={active ? "check" : "plus"} size={13} />
      As {slot.toUpperCase()}
    </button>
  );
}

/**
 * One stored document: what it is, whether it was readable, and how to use it. The row opens to show the text
 * that was read from it; the two buttons at the end choose it for the pair check (see PairTray).
 */
export function DocumentRow({
  doc,
  index,
  open,
  slot,
  onToggle,
  onPick,
  onChanged,
}: {
  doc: DocumentListItem;
  index: number;
  open: boolean;
  /** Which slot of the pair this document fills right now, if any */
  slot: Slot | null;
  onToggle: () => void;
  onPick: (slot: Slot) => void;
  onChanged: () => void;
}) {
  return (
    <div className="border-t border-line first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6" style={{ "--i": Math.min(index, 10) } as React.CSSProperties}>
        <button type="button" onClick={onToggle} aria-expanded={open} data-open={open} className="row-hover animate-rise stagger -mx-2 flex min-w-0 flex-1 basis-72 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-2 py-1.5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-strong">
            <Icon name="file" size={20} />
          </span>
          <span className="min-w-0 flex-1 basis-40">
            <span className="block truncate text-sm font-semibold">{doc.file_name}</span>
            <span className="block text-[11px] text-fg-faint">
              {formatBytes(doc.file_size)} · {relativeTime(doc.updated_at)}
            </span>
          </span>
          <Badge tone={TYPE_TONE[doc.detected_type]} icon="file">{doc.detected_type}</Badge>
          {doc.parse_status === "unreadable" && <Badge tone="warn" icon="alert">Unreadable</Badge>}
          <Badge tone={doc.review_status === "filed" ? "ok" : doc.review_status === "skipped" ? "muted" : "warn"} icon={doc.review_status === "filed" ? "checkCircle" : "clock"}>
            {doc.review_status === "pending" ? "To file" : doc.review_status === "filed" ? "Filed" : "Skipped"}
          </Badge>
          <Icon name="chevronDown" size={18} className={`text-fg-faint transition duration-300 ${open ? "rotate-180 text-accent-strong" : ""}`} />
        </button>

        <div className="flex shrink-0 items-center gap-2" role="group" aria-label={`Use ${doc.file_name} in a pair check`}>
          <SlotButton slot="si" doc={doc} active={slot === "si"} onPick={() => onPick("si")} />
          <SlotButton slot="bl" doc={doc} active={slot === "bl"} onPick={() => onPick("bl")} />
        </div>
      </div>

      <div className="expand" data-open={open}>
        <div>{open && <DocumentDetailPanel id={doc.id} onChanged={onChanged} />}</div>
      </div>
    </div>
  );
}
