import Link from "next/link";
import { BrandMark } from "../brand-mark";

export function Footer() {
  return (
    <footer className="border-t border-line bg-sunken">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 font-semibold">
              <BrandMark className="h-8 w-8" />
              Shipping Doc Verifier
            </div>
            <p className="mt-3 max-w-xs text-sm text-fg-muted">
              Classify shipping emails, extract shipment fields and compare SI against BL, with a person in the loop.
            </p>
          </div>
          <FooterColumn
            title="Product"
            links={[
              { href: "/features/verification", label: "Full pipeline" },
              { href: "/features/classification", label: "Email classification" },
              { href: "/features/extraction", label: "Field extraction" },
              { href: "/features/comparison", label: "SI / BL comparison" },
            ]}
          />
          <FooterColumn
            title="Developers"
            links={[
              { href: "/features/pipeline/api", label: "REST API reference" },
              { href: "/dashboard/settings#connections", label: "MCP connection details" },
            ]}
          />
          <FooterColumn
            title="Account"
            links={[
              { href: "/login", label: "Sign in" },
              { href: "/signup", label: "Create account" },
              { href: "/dashboard", label: "Open the app" },
            ]}
          />
        </div>
        <div className="mt-12 border-t border-line pt-6 text-xs text-fg-faint">© 2026 Shipping Doc Verifier</div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-fg-faint">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-fg-muted">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="transition hover:text-fg">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
