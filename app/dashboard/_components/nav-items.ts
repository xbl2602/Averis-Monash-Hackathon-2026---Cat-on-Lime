import type { IconName } from "../../_components/icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Every screen in the app, in the order the sidebar shows them. The top bar reads its page titles from here too. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: "home" },
      { href: "/features/verification", label: "Full pipeline", icon: "play" },
      { href: "/features/results", label: "Results", icon: "table", badge: "New" },
      { href: "/features/results/conflicts", label: "Conflicts", icon: "swap", badge: "New" },
      { href: "/features/review", label: "Review queue", icon: "flag", badge: "New" },
    ],
  },
  {
    title: "Modules",
    items: [
      { href: "/features/classification", label: "Email classification", icon: "mail" },
      { href: "/features/extraction", label: "Field extraction", icon: "list" },
      { href: "/features/comparison", label: "SI / BL comparison", icon: "compare" },
      // Model lab (Jev) is deliberately left out of the nav: it is an engineering comparison
      // tool (Jev vs Claude), not a shipping-document-verification feature a judge/operator
      // would use. The page still works at /features/jev-lab; see the Settings page link.
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/features/sandbox", label: "Try your own", icon: "sparkles", badge: "New" },
      { href: "/features/import", label: "Documents", icon: "folder", badge: "New" },
    ],
  },
];

export const SETTINGS_HREF = "/dashboard/settings";

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** The nav entry that owns this URL: the longest href that is the path or a parent of it. */
export function activeNavHref(pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of ALL_ITEMS) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

export function pageTitle(pathname: string): string {
  if (pathname === SETTINGS_HREF) return "Settings";
  const href = activeNavHref(pathname);
  return ALL_ITEMS.find((item) => item.href === href)?.label ?? "Dashboard";
}
