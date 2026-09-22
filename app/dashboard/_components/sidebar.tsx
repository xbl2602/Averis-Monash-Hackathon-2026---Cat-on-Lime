"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "../../_components/brand-mark";
import { Icon } from "../../_components/icon";
import { NAV_GROUPS, SETTINGS_HREF, activeNavHref } from "./nav-items";

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = activeNavHref(pathname);
  const settingsActive = pathname === SETTINGS_HREF;

  let index = 0;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface-solid backdrop-blur-xl transition-transform lg:bg-sidebar duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-6 py-6 font-semibold text-fg">
        <BrandMark className="h-9 w-9" />
        <span className="text-sm leading-tight">Shipping Doc Verifier</span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-faint">{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === activeHref;
                const delay = index++;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    style={{ "--i": delay } as React.CSSProperties}
                    className={`animate-rise stagger group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                      active ? "bg-accent/15 text-fg" : "text-fg-muted hover:bg-sunken hover:text-fg"
                    }`}
                  >
                    <Icon
                      name={item.icon}
                      size={20}
                      className={`transition duration-300 group-hover:scale-110 ${active ? "text-accent-strong" : "text-fg-faint group-hover:text-accent-strong"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-accent-strong" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-line px-3 py-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-fg-muted transition hover:bg-sunken hover:text-fg"
        >
          <Icon name="arrowLeft" size={20} className="text-fg-faint" />
          Back to website
        </Link>
        <Link
          href={SETTINGS_HREF}
          onClick={onNavigate}
          aria-current={settingsActive ? "page" : undefined}
          className={`group flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition ${
            settingsActive ? "bg-accent/15 text-fg" : "border border-line bg-sunken text-fg hover:border-line-strong"
          }`}
        >
          <Icon name="gear" size={22} className="text-accent-strong transition duration-500 group-hover:rotate-90" />
          Settings
          <Icon name="arrowRight" size={16} className="ml-auto text-fg-faint transition group-hover:translate-x-1" />
        </Link>
      </div>
    </aside>
  );
}
