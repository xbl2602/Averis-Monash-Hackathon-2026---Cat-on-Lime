"use client";

import { useState, type ReactNode } from "react";
import { EMAIL_CATEGORIES } from "@/lib/shared/types";
import { Icon, type IconName } from "../../../_components/icon";
import type { EmailCategory, ResultRow } from "../../../_lib/contracts";
import type { ProviderOption } from "../../../_lib/provider-options";
import { CATEGORY_META } from "../../../_lib/labels";
import { CorrectForm } from "./correct-forms";
import { DISPOSITION_LABELS, REVIEW_STATE_META, type ApplyReviewActionRequest, type ReviewDisposition, type ReviewModule, type ReviewQueueItem } from "./review-api";

type Panel = "correct" | "defer" | "disposition" | "note" | "rerun" | null;

function ActionButton({ icon, label, onClick, disabled, active, tone }: { icon: IconName; label: string; onClick: () => void; disabled: boolean; active?: boolean; tone?: "ok" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`btn !px-4 !py-2 ${tone === "ok" ? "btn-primary btn-shine" : "btn-glass"} ${active ? "!border-accent" : ""}`}
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function MiniForm({ title, children, onSubmit, submitLabel, busy, canSubmit = true, onCancel }: { title: string; children: ReactNode; onSubmit: () => void; submitLabel: string; busy: boolean; canSubmit?: boolean; onCancel: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="animate-pop space-y-3 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4">
      <div className="text-sm font-bold">{title}</div>
      {children}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || !canSubmit} className="btn btn-primary btn-shine !py-2">
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-glass !py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The buttons for one review item and the small form each one opens. Everything is disabled while write
 * access is locked (the page shows an unlock card above); the server checks the token again on every call.
 */
export function ActionBar({
  module,
  item,
  row,
  locked,
  busy,
  canUndo,
  providers,
  onApply,
  onUndo,
}: {
  module: ReviewModule;
  item: ReviewQueueItem;
  row: ResultRow | null;
  locked: boolean;
  busy: boolean;
  canUndo: boolean;
  providers: ProviderOption[];
  onApply: (request: Omit<ApplyReviewActionRequest, "email_id" | "expected_updated_at">) => Promise<boolean>;
  onUndo: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [text, setText] = useState("");
  const [disposition, setDisposition] = useState("accepted");
  const [target, setTarget] = useState<EmailCategory>("BL_COMPARISON");
  const [provider, setProvider] = useState(providers.find((p) => p.id === "gemini")?.id ?? providers[0]?.id ?? "");

  const deferred = item.override?.review_state === "deferred";
  const off = locked || busy;
  const toggle = (next: Exclude<Panel, null>) => {
    setText("");
    setPanel((current) => (current === next ? null : next));
  };
  const done = async (request: Omit<ApplyReviewActionRequest, "email_id" | "expected_updated_at">) => {
    if (await onApply(request)) setPanel(null);
  };
  const canCorrect = module !== "pipeline";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canCorrect && <ActionButton icon="checkCircle" label="Confirm" tone="ok" disabled={off} onClick={() => void done({ action: "confirm" })} />}
        {canCorrect && <ActionButton icon="edit" label="Correct…" disabled={off} active={panel === "correct"} onClick={() => toggle("correct")} />}
        {deferred ? (
          <ActionButton icon="play" label="Bring back" disabled={off} onClick={() => void done({ action: "undefer" })} />
        ) : (
          <ActionButton icon="pause" label="Set aside…" disabled={off} active={panel === "defer"} onClick={() => toggle("defer")} />
        )}
        {module !== "pipeline" && <ActionButton icon="target" label="Destination…" disabled={off} active={panel === "disposition"} onClick={() => toggle("disposition")} />}
        <ActionButton icon="note" label="Note…" disabled={off} active={panel === "note"} onClick={() => toggle("note")} />
        <ActionButton icon="refresh" label="Re-run…" disabled={off} active={panel === "rerun"} onClick={() => toggle("rerun")} />
        <ActionButton icon="undo" label="Undo last" disabled={off || !canUndo} onClick={onUndo} />
      </div>

      {panel === "correct" && <CorrectForm module={module} item={item} row={row} busy={busy} onCancel={() => setPanel(null)} onSubmit={(payload, note) => void done({ action: "correct", payload, ...(note.trim() ? { note: note.trim() } : {}) })} />}

      {panel === "defer" && (
        <MiniForm title="Set this aside for later" submitLabel="Set aside" busy={busy} onCancel={() => setPanel(null)} onSubmit={() => void done({ action: "defer", ...(text.trim() ? { reason: text.trim() } : {}) })}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reason (optional), e.g. waiting for the shipper" aria-label="Reason" className="field" />
          <p className="text-xs text-fg-faint">It leaves the queue but stays unresolved: the submission export counts it as still open.</p>
        </MiniForm>
      )}

      {panel === "disposition" && (
        <MiniForm title="Where does this go next?" submitLabel="Set destination" busy={busy} onCancel={() => setPanel(null)} onSubmit={() => void done({ action: "disposition", payload: { disposition: disposition as ReviewDisposition, ...(disposition === "routed" ? { category: target } : {}) } })}>
          <select value={disposition} onChange={(e) => setDisposition(e.target.value)} aria-label="Destination" className="field">
            {Object.entries(DISPOSITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {disposition === "routed" && (
            <select value={target} onChange={(e) => setTarget(e.target.value as EmailCategory)} aria-label="Route to" className="field animate-rise">
              {EMAIL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  Route to: {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          )}
        </MiniForm>
      )}

      {panel === "note" && (
        <MiniForm title="Add a note" submitLabel="Add note" busy={busy} canSubmit={text.trim() !== ""} onCancel={() => setPanel(null)} onSubmit={() => void done({ action: "note", note: text.trim() })}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="What did you check, and what did you find?" aria-label="Note" className="field field-area resize-y" />
          <p className="text-xs text-fg-faint">Notes only go in the history. They never change the result.</p>
        </MiniForm>
      )}

      {panel === "rerun" && (
        <MiniForm title="Run the pipeline again for this email" submitLabel="Re-run" busy={busy} canSubmit={provider !== ""} onCancel={() => setPanel(null)} onSubmit={() => void done({ action: "rerun", payload: { provider } })}>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Fallback model" className="field">
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.ready ? "" : " · key missing"}
              </option>
            ))}
          </select>
          {item.override && (
            <p className="text-xs font-semibold text-warn">This replaces your current decision here ({REVIEW_STATE_META[item.override.review_state].label}) with the new system answer.</p>
          )}
          <p className="text-xs text-fg-faint">The system works this email out again from scratch, and the newest action wins: if the re-run succeeds, it replaces every earlier decision on this email, in this tab and the others. Each one stays in the history, and Undo last brings it back. If the re-run fails, nothing is replaced.</p>
        </MiniForm>
      )}
    </div>
  );
}
