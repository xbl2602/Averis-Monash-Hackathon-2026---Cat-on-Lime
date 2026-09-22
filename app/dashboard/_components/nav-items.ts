import type { IconName } from "../../_components/icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Every screen a person using the product needs, in the order the sidebar shows them.
 * Internal tools (the Jev model lab, developer mode) are deliberately not here: they still exist at
 * their own addresses, but the product's navigation is for the people doing the work.
 * The top bar reads its page titles from this list too.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: "home" },
      { href: "/features/verification", label: "Run verification", icon: "play" },
      { href: "/features/results", label: "Results", icon: "table" },
      { href: "/features/results/conflicts", label: "Conflicts", icon: "swap" },
      { href: "/features/review", label: "Review queue", icon: "flag" },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/features/classification", label: "Classify emails", icon: "mail" },
      { href: "/features/extraction", label: "Extract fields", icon: "list" },
      { href: "/features/comparison", label: "Compare SI & BL", icon: "compare" },
      { href: "/features/sandbox", label: "Try your own files", icon: "sparkles" },
      { href: "/features/import", label: "Upload documents", icon: "folder" },
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

/** Pages that exist but are deliberately kept out of the sidebar; the top bar still needs their name. */
const UNLISTED_TITLES: Record<string, string> = {
  [SETTINGS_HREF]: "Settings",
  "/features/devmode": "Developer mode",
  "/features/jev-lab": "Model lab",
};

export function pageTitle(pathname: string): string {
  const unlisted = UNLISTED_TITLES[pathname];
  if (unlisted) return unlisted;
  const href = activeNavHref(pathname);
  return ALL_ITEMS.find((item) => item.href === href)?.label ?? "Dashboard";
}
