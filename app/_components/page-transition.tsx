import type { ReactNode } from "react";

/** Wraps a page so it eases in whenever you navigate to it (used by the app's template.tsx files). */
export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="animate-rise">{children}</div>;
}
