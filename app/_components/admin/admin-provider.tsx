"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { apiRequest, type ApiResult } from "../../_lib/api-client";
import { useToast } from "../toast";

/**
 * Write access for this browser tab.
 *
 * Reading is open to everyone; anything that changes data needs the server's admin token. The visitor
 * types it here once, and it lives only in memory for this tab: never in localStorage or a cookie, never
 * shown again, and only ever sent as the x-admin-token header to the write endpoints, which check it
 * on the server. Nothing in this app injects a token on the visitor's behalf.
 */
interface AdminContextValue {
  unlocked: boolean;
  unlock: (token: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  lock: () => void;
  /** Like apiRequest, plus the token. If the server rejects the token, the tab locks again. */
  adminRequest: <T>(url: string, init?: RequestInit) => Promise<ApiResult<T>>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const tokenRef = useRef<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const lock = useCallback(() => {
    tokenRef.current = null;
    setUnlocked(false);
  }, []);

  const unlock = useCallback(async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed) return { ok: false as const, message: "Enter the admin token first." };

    // A write request with an empty change list is a harmless way to ask "is this token accepted?":
    // the server checks the token before anything else, so a wrong one answers 401/403 and a right
    // one answers 400 (or 503 when no database is connected). Nothing is ever written.
    const probe = await apiRequest<unknown>("/features/config/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": trimmed },
      body: JSON.stringify({ updates: [] }),
    });
    if (!probe.ok && probe.status === 401) return { ok: false as const, message: "That token was not accepted." };
    if (!probe.ok && probe.status === 403) {
      return { ok: false as const, message: "Writing is switched off on this server because no admin token is configured." };
    }
    if (!probe.ok && probe.status === 0) return { ok: false as const, message: probe.error.message };

    tokenRef.current = trimmed;
    setUnlocked(true);
    return { ok: true as const };
  }, []);

  const adminRequest = useCallback(
    async <T,>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> => {
      const token = tokenRef.current;
      if (!token) {
        return {
          ok: false,
          status: 401,
          error: { message: "This action needs the admin token. Unlock write access first." },
          databaseDown: false,
          aborted: false,
        };
      }
      const result = await apiRequest<T>(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string> | undefined), "x-admin-token": token },
      });
      if (!result.ok && (result.status === 401 || result.status === 403)) {
        lock();
        toast({ tone: "bad", title: "Write access was rejected", detail: "The token is no longer accepted, so this tab is read-only again." });
      }
      return result;
    },
    [lock, toast]
  );

  const value = useMemo(() => ({ unlocked, unlock, lock, adminRequest }), [unlocked, unlock, lock, adminRequest]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
