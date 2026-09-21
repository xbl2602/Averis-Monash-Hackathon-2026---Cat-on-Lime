"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "../icon";
import { useToast } from "../toast";
import { useAdmin } from "./admin-provider";

/** Password-style field + button that turns on write access for this tab. */
export function UnlockForm({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) {
  const { unlock } = useAdmin();
  const toast = useToast();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await unlock(token);
    setBusy(false);
    setToken(""); // never keep the typed value around
    if (result.ok) {
      toast({ tone: "ok", title: "Write access unlocked", detail: "It lasts until you close or reload this tab." });
      onDone?.();
    } else {
      setMessage(result.message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={`flex gap-2 ${compact ? "flex-col" : "flex-col sm:flex-row"}`}>
        <div className="relative flex-1">
          <Icon name="key" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" />
          <input
            type="password"
            name="admin-token"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            aria-label="Admin token"
            className="field !pl-11"
          />
        </div>
        <button type="submit" disabled={busy || token.trim() === ""} className="btn btn-primary btn-shine !py-2.5">
          <Icon name="unlock" size={17} />
          {busy ? "Checking…" : "Unlock"}
        </button>
      </div>
      {message && (
        <p role="alert" className="animate-shake text-xs font-medium text-bad">
          {message}
        </p>
      )}
    </form>
  );
}
