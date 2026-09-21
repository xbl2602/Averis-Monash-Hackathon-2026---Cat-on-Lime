"use client";

import type { ReactNode } from "react";
import { AdminProvider } from "./admin/admin-provider";
import { RunStatusProvider } from "./run-status";
import { ToastProvider } from "./toast";

/**
 * App-wide client state: pop-up messages, write access, and long-running actions.
 * Mounted once in the root layout so all three survive page changes — the run tracker especially,
 * since /dashboard and /features are separate route trees whose shells remount when you cross between them.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AdminProvider>
        <RunStatusProvider>{children}</RunStatusProvider>
      </AdminProvider>
    </ToastProvider>
  );
}
