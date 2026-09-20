"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "../../_components/brand-mark";
import { Icon, type IconName } from "../../_components/icon";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Overview", icon: "home" },
  { href: "/features/verification", label: "Full pipeline", icon: "play" },
  { href: "/features/classification", label: "Email classification", icon: "mail" },
  { href: "/features/extraction", label: "Field extraction", icon: "list" },
  { href: "/features/comparison", label: "SI / BL comparison", icon: "compare" },
  { href: "/features/jev-lab", label: "Model lab (Jev)", icon: "flask" },
];

const SETTINGS_HREF = "/dashboard/settings";

function isActive(pathname: string, href: string): boolean {
  // "/dashboard" must only match itself, otherwise it would also light up on /dashboard/settings
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const settingsActive = isActive(pathname, SETTINGS_HREF);

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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                active ? "bg-accent/15 text-fg" : "text-fg-muted hover:bg-sunken hover:text-fg"
              }`}
            >
              <Icon
                name={item.icon}
                size={20}
                className={active ? "text-accent-strong" : "text-fg-faint transition group-hover:text-accent-strong"}
              />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-strong" />}
            </Link>
          );
        })}
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
            settingsActive
              ? "bg-accent/15 text-fg"
              : "border border-line bg-sunken text-fg hover:border-line-strong"
          }`}
        >
          <Icon
            name="gear"
            size={22}
            className="text-accent-strong transition duration-500 group-hover:rotate-90"
          />
          Settings
          <Icon name="arrowRight" size={16} className="ml-auto text-fg-faint" />
        </Link>
      </div>
    </aside>
  );
}
