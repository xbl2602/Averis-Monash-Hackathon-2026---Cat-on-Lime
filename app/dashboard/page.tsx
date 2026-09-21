import Link from "next/link";
import { listSampleEmails } from "@/lib/shared/inbox";
import { LLM_PROVIDERS, isProviderConfigured } from "@/lib/llm";
import { Icon, type IconName } from "../_components/icon";
import { HeroBanner } from "../_components/motion/hero-banner";
import { FeatureGrid, type FeatureTile } from "./_components/feature-grid";
import { HeroAside } from "./_components/hero-aside";
import { LiveStats } from "./_components/live-stats";

// Re-read env vars and sample data on every visit: the numbers on this page must reflect the current state
export const dynamic = "force-dynamic";

const TILES: FeatureTile[] = [
  { href: "/features/verification", tag: "All-in-one", title: "Full pipeline", desc: "Run classification, extraction and comparison over the inbox in one go, retry failures, and see the batch summary.", icon: "play", accent: "var(--color-indigo)" },
  { href: "/features/results", tag: "Workspace", title: "Results", desc: "Browse every email with its category, outcome and extracted fields. Filter, sort, group and export.", icon: "table", accent: "var(--color-mint)", isNew: true },
  { href: "/features/results/conflicts", tag: "Workspace", title: "Conflicts", desc: "SI and BL side by side with the differing characters marked, plus exact or tolerance-based number search.", icon: "swap", accent: "var(--color-amber)", isNew: true },
  { href: "/features/review", tag: "Workspace", title: "Review queue", desc: "Confirm, correct, defer or re-run anything the system was unsure about. Every action can be undone.", icon: "flag", accent: "var(--color-halo)", isNew: true },
  { href: "/features/classification", tag: "Step 01", title: "Email classification", desc: "Pick any sample email and see how it is classified, how confident the model is, and whether it needs a person.", icon: "mail", accent: "var(--color-mint)" },
  { href: "/features/extraction", tag: "Step 02", title: "Field extraction", desc: "Read the seven shipment fields from any attachment, with the source line behind every value.", icon: "list", accent: "var(--color-amber)" },
  { href: "/features/comparison", tag: "Step 03", title: "SI / BL comparison", desc: "Compare two documents field by field, or type in your own values to see how the engine judges them.", icon: "compare", accent: "var(--color-halo)" },
  { href: "/features/sandbox", tag: "Try it", title: "Try your own files", desc: "Drop in your own SI and BL. Nothing is saved and no database is needed.", icon: "sparkles", accent: "var(--color-indigo)", isNew: true },
  { href: "/features/import", tag: "Tools", title: "Documents", desc: "Upload documents into the shared pool, see how each one was identified, and file the unknown ones.", icon: "folder", accent: "var(--color-mint)", isNew: true },
  // Model lab (Jev) is deliberately not a tile here: it's an internal engineering comparison
  // tool, not a shipping-document-verification feature. Still reachable at /features/jev-lab
  // (linked from Settings) for the team/judges who want to see it.
];

const SURFACES: { icon: IconName; title: string; detail: string }[] = [
  { icon: "laptop", title: "Web app", detail: "Responsive, for desktop and phone" },
  { icon: "code", title: "REST API", detail: "HTTP endpoints under /features/*/api" },
  { icon: "plug", title: "MCP server", detail: "Streamable HTTP at /core/mcp-server" },
];

/** The sample inbox is optional context: if it cannot be read the page still loads, just without that number. */
async function countSampleEmails(): Promise<number> {
  try {
    return (await listSampleEmails()).length;
  } catch {
    return 0;
  }
}

export default async function DashboardPage() {
  const sampleCount = await countSampleEmails();
  const configuredCount = LLM_PROVIDERS.filter((p) => isProviderConfigured(p.id)).length;

  return (
    <div className="space-y-10">
      <HeroBanner
        eyebrow="Control room"
        title="Shipping paperwork,"
        highlight="checked in seconds."
        description="Every email classified, every SI and BL compared, every doubt flagged for a person. Live numbers below; with no API key the local rules engine keeps the pipeline running."
        actions={
          <>
            <Link href="/features/verification" className="btn btn-primary btn-shine !px-6 !py-3">
              <Icon name="play" size={16} />
              Run full pipeline
            </Link>
            <Link href="/features/review" className="btn btn-glass !px-6 !py-3">
              <Icon name="flag" size={16} />
              Open review queue
            </Link>
          </>
        }
        aside={
          <HeroAside
            items={[
              { icon: "inbox", label: "Sample emails ready", value: sampleCount },
              { icon: "cpu", label: `Models ready of ${LLM_PROVIDERS.length}`, value: configuredCount },
              { icon: "layers", label: "Core steps in every run", value: 3 },
            ]}
          />
        }
      />

      <LiveStats />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Everything in the app</h2>
          <span className="text-xs text-fg-faint">Search above to filter</span>
        </div>
        <FeatureGrid tiles={TILES} />
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="text-lg font-bold">One engine, three ways to connect</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {SURFACES.map((s, i) => (
            <div
              key={s.title}
              style={{ "--i": i } as React.CSSProperties}
              className="animate-rise stagger flex items-center gap-4 rounded-2xl border border-line bg-sunken p-4"
            >
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
