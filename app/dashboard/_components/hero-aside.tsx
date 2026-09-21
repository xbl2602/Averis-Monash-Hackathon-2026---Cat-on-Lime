"use client";

import { CountUp } from "../../_components/motion/count-up";
import { Icon, type IconName } from "../../_components/icon";

/** Three little glass counters that float beside the overview headline. */
export function HeroAside({ items }: { items: { icon: IconName; label: string; value: number; suffix?: string }[] }) {
  return (
    <div className="flex gap-3 lg:flex-col">
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{ animationDelay: `${i * 0.9}s` }}
          className="animate-float flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg backdrop-blur-md lg:w-56 lg:flex-none"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-strong">
            <Icon name={item.icon} size={20} />
          </span>
          <div className="min-w-0">
            <div className="text-xl font-extrabold leading-none">
              <CountUp value={item.value} />
              {item.suffix}
            </div>
            <div className="mt-1 truncate text-[11px] text-fg-muted">{item.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
