import Link from "next/link";

// Legacy top navigation. /features/* pages now render inside the dashboard shell
// (app/dashboard/_components/dashboard-shell.tsx), so nothing imports this any more.
const FEATURES = [
  { href: "/features/verification", label: "Full pipeline" },
  { href: "/features/classification", label: "Email classification" },
  { href: "/features/extraction", label: "Field extraction" },
  { href: "/features/comparison", label: "SI / BL comparison" },
  { href: "/features/jev-lab", label: "Model lab (Jev)" },
];

export function Nav() {
  return (
    <nav className="border-b border-line bg-surface backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" className="font-semibold text-fg">
          Shipping Doc Verifier
        </Link>
        <div className="flex flex-wrap gap-x-1 gap-y-2 text-sm">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href} className="rounded-full px-3 py-1.5 text-fg-muted transition hover:bg-sunken hover:text-fg">
              {f.label}
            </Link>
          ))}
        </div>
        <Link href="/dashboard" className="ml-auto text-sm font-medium text-accent-strong hover:underline">
          ← Overview
        </Link>
      </div>
    </nav>
  );
}
