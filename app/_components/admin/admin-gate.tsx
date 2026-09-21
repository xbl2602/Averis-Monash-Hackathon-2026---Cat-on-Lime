"use client";

import type { ReactNode } from "react";
import { Icon } from "../icon";
import { useAdmin } from "./admin-provider";
import { UnlockForm } from "./unlock-form";

/** Shows its children once write access is on; until then, an inline card that explains and offers the unlock. */
export function AdminGate({ children, action = "make changes" }: { children: ReactNode; action?: string }) {
  const { unlocked } = useAdmin();
  if (unlocked) return <>{children}</>;
  return <LockedCard action={action} />;
}

export function LockedCard({ action = "make changes" }: { action?: string }) {
  return (
    <div className="animate-rise rounded-2xl border border-dashed border-line-strong bg-sunken p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
          <Icon name="lock" size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">Read-only right now</h3>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Anyone can look. To {action}, enter the admin token. It stays in this tab only and is never saved.
          </p>
          <div className="mt-4 max-w-md">
            <UnlockForm />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small "needs unlock" marker for buttons that are disabled while locked. */
export function useCanWrite(): boolean {
  return useAdmin().unlocked;
}
