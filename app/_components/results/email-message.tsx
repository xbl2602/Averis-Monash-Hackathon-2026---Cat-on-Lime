"use client";

import { useState } from "react";
import { Icon } from "../icon";

/**
 * The email's own words, folded away until asked for. Renders nothing while the server sends no body
 * (see _lib/backend-contract.ts), so callers can place it unconditionally.
 */
export function EmailMessage({ body, from, subject, defaultOpen = false }: { body?: string | null; from?: string; subject?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const text = body?.trim();
  if (!text) return null;

  return (
    <section className="min-w-0 rounded-2xl border border-line bg-sunken">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <Icon name="mail" size={17} className="shrink-0 text-accent-strong" />
        <span className="flex-1 text-sm font-semibold">Read the email</span>
        <span className="hidden text-xs text-fg-faint sm:inline">{text.length.toLocaleString("en-US")} characters</span>
        <Icon name="chevronDown" size={16} className={`shrink-0 text-fg-faint transition duration-300 ${open ? "rotate-180 text-accent-strong" : ""}`} />
      </button>
      <div className="expand" data-open={open}>
        <div>
          {open && (
            <div className="space-y-3 border-t border-line px-4 py-4">
              {(from || subject) && (
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  {from && (
                    <>
                      <dt className="text-fg-faint">From</dt>
                      <dd className="truncate font-medium">{from}</dd>
                    </>
                  )}
                  {subject && (
                    <>
                      <dt className="text-fg-faint">Subject</dt>
                      <dd className="truncate font-medium">{subject}</dd>
                    </>
                  )}
                </dl>
              )}
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-surface-solid p-4 font-sans text-sm leading-relaxed">{text}</pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
