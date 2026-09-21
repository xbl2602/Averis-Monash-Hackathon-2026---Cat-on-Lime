"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EmailOption } from "../_lib/attachments";
import { Icon } from "./icon";

const MAX_SHOWN = 40;

/**
 * Search-as-you-type picker for the sample inbox (hundreds of emails, so a plain dropdown would be
 * unusable). Type part of an ID, sender or subject; arrow keys and Enter work; Escape closes.
 */
export function EmailPicker({ emails, value, onChange, label = "Email" }: { emails: EmailOption[]; value: string; onChange: (id: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const selected = emails.find((e) => e.email_id === value);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? emails.filter((e) => `${e.email_id} ${e.subject} ${e.from}`.toLowerCase().includes(q)) : emails;
    return list.slice(0, MAX_SHOWN);
  }, [emails, query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => !root.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(email: EmailOption) {
    onChange(email.email_id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={root}>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="email-picker-list"
          aria-autocomplete="list"
          value={open ? query : selected ? `${selected.email_id} · ${selected.subject}` : ""}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={`Search ${emails.length.toLocaleString("en-US")} emails by ID, sender or subject`}
          className="field !pl-11"
        />
      </div>
      {open && (
        <ul id="email-picker-list" role="listbox" className="animate-pop absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-line bg-surface-solid p-1.5 shadow-2xl">
          {matches.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-muted">No email matches &ldquo;{query}&rdquo;.</li>}
          {matches.map((email, i) => (
            <li key={email.email_id} role="option" aria-selected={email.email_id === value}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(email)}
                className={`flex w-full flex-col items-start rounded-xl px-3.5 py-2.5 text-left transition ${i === active ? "bg-accent/12" : ""}`}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="font-mono text-xs font-bold text-accent-strong">{email.email_id}</span>
                  {email.email_id === value && <Icon name="check" size={14} className="text-ok" />}
                  <span className="ml-auto text-[11px] text-fg-faint">{email.attachments.length} attachment{email.attachments.length === 1 ? "" : "s"}</span>
                </span>
                <span className="w-full truncate text-sm">{email.subject || "(no subject)"}</span>
                <span className="w-full truncate text-[11px] text-fg-faint">{email.from}</span>
              </button>
            </li>
          ))}
          {matches.length === MAX_SHOWN && <li className="px-4 py-2 text-center text-[11px] text-fg-faint">Showing the first {MAX_SHOWN}. Keep typing to narrow it down.</li>}
        </ul>
      )}
    </div>
  );
}
