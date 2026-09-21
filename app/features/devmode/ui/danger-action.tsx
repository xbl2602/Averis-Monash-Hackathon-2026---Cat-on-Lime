"use client";

import { useState } from "react";
import { Icon, type IconName } from "../../../_components/icon";

/**
 * One destructive action card: title, explanation, and a text input that must match
 * `confirmPhrase` exactly before the button unlocks. This is deliberately not a
 * "Are you sure? Yes/No" dialog — typing the phrase is the point (see UI_GUIDE.md §2.10:
 * a one-click confirm does not stop a slip of the mouse, typing does).
 */
export function DangerAction({
  icon,
  title,
  description,
  confirmPhrase,
  actionLabel,
  busy,
  onConfirm,
}: {
  icon: IconName;
  title: string;
  description: string;
  confirmPhrase: string;
  actionLabel: string;
  busy: boolean;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed === confirmPhrase;

  return (
    <div className="rounded-2xl border border-bad/40 bg-bad-soft p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bad/15 text-bad">
          <Icon name={icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">{description}</p>

          <label className="mt-4 block text-xs font-semibold text-fg-muted">
            Type <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-fg">{confirmPhrase}</span> to enable this button
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
            spellCheck={false}
            className="field mt-2 !rounded-xl font-mono text-sm"
          />

          <button
            type="button"
            disabled={!matches || busy}
            onClick={onConfirm}
            className="btn mt-3 !bg-bad !py-2.5 text-white"
          >
            <Icon name={icon} size={16} />
            {busy ? "Working…" : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
