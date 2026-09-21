import Link from "next/link";
import type { ReactNode } from "react";
import type { ApiErrorInfo } from "../api-error";
import { ErrorNotice } from "../error-notice";
import { Icon, type IconName } from "../icon";

/** Friendly empty state: big icon, one line of explanation, optional action. */
export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col items-center px-6 py-14 text-center">
      <span className="animate-float flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/12 text-accent-strong">
        <Icon name={icon} size={38} />
      </span>
      <h3 className="mt-6 text-lg font-bold">{title}</h3>
      {children && <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * Shown when the server has no database connected. That is a set-up step, not an error: it says
 * what to do, and that the parts that do not need a database (previews, sandbox) still work.
 */
export function DatabaseDown({ what = "This page" }: { what?: string }) {
  return (
    <div className="card overflow-hidden">
      <EmptyState
        icon="database"
        title="Connect a database to see this"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/settings#data" className="btn btn-primary btn-shine">
              <Icon name="gear" size={16} />
              Open data settings
            </Link>
            <Link href="/features/sandbox" className="btn btn-glass">
              <Icon name="sparkles" size={16} />
              Try your own files instead
            </Link>
          </div>
        }
      >
        {what} reads saved results from Supabase, and this server does not have one connected yet. Add the project URL and key
        to the server settings and reload. Pipeline previews and the sandbox work without a database.
      </EmptyState>
    </div>
  );
}

/** A failed load with a retry button. */
export function LoadError({ error, onRetry }: { error: ApiErrorInfo; onRetry?: () => void }) {
  return (
    <div className="space-y-3">
      <ErrorNotice error={error} />
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-glass !py-2">
          <Icon name="refresh" size={16} />
          Try again
        </button>
      )}
    </div>
  );
}
