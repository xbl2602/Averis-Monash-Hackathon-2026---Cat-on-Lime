import Link from "next/link";
import { listSampleEmails } from "@/lib/shared/inbox";
import { LLM_PROVIDERS, isProviderConfigured } from "@/lib/llm";
import { Icon, type IconName } from "../_components/icon";
import { FeatureGrid, type FeatureTile } from "./_components/feature-grid";

// Re-read env vars and sample data on every visit: the numbers on this page must reflect the current state
export const dynamic = "force-dynamic";

const TILES: FeatureTile[] = [
  {
    href: "/features/verification",
    tag: "All-in-one",
    title: "Full pipeline",
    desc: "Run classification, extraction and comparison over the inbox in one go, with a batch summary at the end.",
    icon: "play",
    accent: "var(--color-indigo)",
  },
  {
    href: "/features/classification",
    tag: "Step 01",
    title: "Email classification",
    desc: "Decide whether an email is a document comparison, new SI request, invoice query, general message or spam.",
    icon: "mail",
    accent: "var(--color-mint)",
  },
  {
    href: "/features/extraction",
    tag: "Step 02",
    title: "Field extraction",
    desc: "Pull shipper, consignee, ports, container count and weight out of an email or its attachment.",
    icon: "list",
    accent: "var(--color-amber)",
  },
  {
    href: "/features/comparison",
    tag: "Step 03",
    title: "SI / BL comparison",
    desc: "Compare the two documents field by field, show the differences, and flag anything a person should check.",
    icon: "compare",
    accent: "var(--color-halo)",
  },
  {
    href: "/features/jev-lab",
    tag: "Lab",
    title: "Model lab (Jev)",
    desc: "Try the Jev structured-decision model on a sample email and compare it with Claude.",
    icon: "flask",
    accent: "var(--color-royal)",
  },
];

const SURFACES: { icon: IconName; title: string; detail: string }[] = [
  { icon: "laptop", title: "Web app", detail: "Responsive, for desktop and phone" },
  { icon: "code", title: "REST API", detail: "HTTP endpoints under /features/*/api" },
  { icon: "plug", title: "MCP server", detail: "Streamable HTTP at /core/mcp-server" },
];

export default async function DashboardPage() {
  const emails = await listSampleEmails();
  const configuredCount = LLM_PROVIDERS.filter((p) => isProviderConfigured(p.id)).length;

  const stats = [
    { icon: "inbox", label: "Sample emails", value: emails.length, note: "loaded and ready to process" },
    { icon: "cpu", label: "Models ready", value: `${configuredCount}/${LLM_PROVIDERS.length}`, note: "providers with a key or local access" },
    { icon: "layers", label: "Core steps", value: 3, note: "classify, extract, compare" },
    { icon: "plug", label: "Ways to connect", value: 3, note: "web, REST API, MCP" },
  ] satisfies { icon: IconName; label: string; value: string | number; note: string }[];

  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Control room</span>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Overview</h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted">
            Shipping document verification at a glance. With no API key configured, the system falls back to its local
            rules engine so the pipeline always runs.
          </p>
        </div>
        <Link href="/features/verification" className="btn btn-primary self-start !px-6 !py-3">
          Run full pipeline
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
              <Icon name={s.icon} size={22} />
            </span>
            <div className="mt-4 text-2xl font-extrabold sm:text-3xl">{s.value}</div>
            <div className="mt-1 text-sm font-medium text-fg-muted">{s.label}</div>
            <div className="mt-0.5 text-xs text-fg-faint">{s.note}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Modules</h2>
          <span className="text-xs text-fg-faint">Select one to open it</span>
        </div>
        <FeatureGrid tiles={TILES} />
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="text-lg font-bold">One engine, three ways to connect</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {SURFACES.map((s) => (
            <div key={s.title} className="flex items-center gap-4 rounded-2xl border border-line bg-sunken p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
                <Icon name={s.icon} size={24} />
              </span>
              <div>
                <div className="text-sm font-bold">{s.title}</div>
                <div className="mt-0.5 font-mono text-xs text-fg-faint">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
