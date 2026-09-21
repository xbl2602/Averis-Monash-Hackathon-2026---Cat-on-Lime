"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";

type ToastTone = "ok" | "bad" | "warn" | "info";
interface ToastInput {
  tone: ToastTone;
  title: string;
  detail?: string;
}
interface ToastItem extends ToastInput {
  id: number;
}

const TONE_STYLE: Record<ToastTone, { icon: IconName; color: string }> = {
  ok: { icon: "checkCircle", color: "text-ok" },
  bad: { icon: "xCircle", color: "text-bad" },
  warn: { icon: "alert", color: "text-warn" },
  info: { icon: "info", color: "text-accent-strong" },
};

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, item.tone === "bad" ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [item.tone, onClose]);

  const style = TONE_STYLE[item.tone];
  return (
    <div
      role={item.tone === "bad" ? "alert" : "status"}
      className="card animate-slide-in flex items-start gap-3 !bg-surface-solid p-4 shadow-2xl"
    >
      <Icon name={style.icon} size={22} className={`mt-0.5 shrink-0 ${style.color}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{item.title}</div>
        {item.detail && <div className="mt-0.5 break-words text-xs text-fg-muted">{item.detail}</div>}
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded-full p-1 text-fg-faint transition hover:bg-sunken hover:text-fg">
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

/** App-wide pop-up messages ("Saved", "Token rejected"...). Sits under the top bar, top right. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-3), { ...input, id }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastCard item={item} onClose={() => setItems((prev) => prev.filter((t) => t.id !== item.id))} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
