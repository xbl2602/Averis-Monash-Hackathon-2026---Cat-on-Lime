"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../icon";
import { useAdmin } from "./admin-provider";
import { UnlockForm } from "./unlock-form";

/** Top-bar status: "Read-only" (click to unlock) or "Write access" (click to lock again). */
export function AdminChip() {
  const { unlocked, lock } = useAdmin();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3.5 text-xs font-semibold transition ${
          unlocked ? "border-transparent bg-ok-soft text-ok" : "border-line bg-sunken text-fg-muted hover:border-line-strong hover:text-fg"
        }`}
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          {unlocked && <span className="absolute inset-0 animate-ping-soft rounded-full bg-ok/40" />}
          <Icon name={unlocked ? "unlock" : "lock"} size={16} />
        </span>
        <span className="hidden sm:inline">{unlocked ? "Write access" : "Read-only"}</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Write access" className="animate-pop absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface-solid p-5 shadow-2xl">
          {unlocked ? (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-soft text-ok">
                  <Icon name="unlock" size={20} />
                </span>
                <div>
                  <div className="text-sm font-bold">Write access is on</div>
                  <div className="text-xs text-fg-muted">This tab can change data until you lock it or close it.</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  lock();
                  setOpen(false);
                }}
                className="btn btn-glass mt-4 w-full !py-2"
              >
                <Icon name="lock" size={16} />
                Lock again
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-fg-muted">
                  <Icon name="lock" size={20} />
                </span>
                <div>
                  <div className="text-sm font-bold">Unlock write access</div>
                  <div className="text-xs text-fg-muted">Viewing is open. Saving, reviewing and uploading need the admin token.</div>
                </div>
              </div>
              <div className="mt-4">
                <UnlockForm compact onDone={() => setOpen(false)} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-fg-faint">The token stays in this tab&rsquo;s memory only. It is never saved or shown again.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
