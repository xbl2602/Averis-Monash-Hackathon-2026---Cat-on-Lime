"use client";

import type { ReactNode } from "react";
import { AdminProvider } from "./admin/admin-provider";
import { ToastProvider } from "./toast";

/** App-wide client state: pop-up messages and write access. Mounted once in the root layout so it survives page changes. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AdminProvider>{children}</AdminProvider>
    </ToastProvider>
  );
}
