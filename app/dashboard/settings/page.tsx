import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "../../_components/icon";
import { listProviderOptions } from "../../_lib/provider-options";
import { AccessSection } from "./_components/access-section";
import { AccountSection } from "./_components/account-section";
import { AppearanceSection } from "./_components/appearance-section";
import { ConfigSection } from "./_components/config-section";
import { ConnectionsSection } from "./_components/connections-section";
import { DataSection } from "./_components/data-section";
import { GmailSection } from "./_components/gmail-section";
import { ModelsSection } from "./_components/models-section";
import { ProcessingSection } from "./_components/processing-section";

export const metadata: Metadata = {
  title: "Settings · Shipping Doc Verifier",
};

// Provider readiness depends on server environment variables, so read it fresh on every visit
export const dynamic = "force-dynamic";

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "processing", label: "Processing", icon: "sliders" },
  { id: "models", label: "Models", icon: "cpu" },
  { id: "access", label: "Write access", icon: "lock" },
  { id: "config", label: "Configuration", icon: "sliders" },
  { id: "data", label: "Data sources", icon: "database" },
  { id: "mail", label: "Gmail", icon: "mail" },
  { id: "connections", label: "Connections", icon: "plug" },
  { id: "account", label: "Account and data", icon: "user" },
];

export default function SettingsPage() {
  const providers = listProviderOptions();

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow">Preferences</span>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          Personalise the app, set processing defaults and find the connection details for the API and MCP server.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-3 rounded-full border border-line bg-sunken px-4 py-2.5 text-sm font-medium text-fg-muted transition hover:border-line-strong hover:text-fg lg:border-transparent lg:bg-transparent lg:hover:bg-sunken"
                >
                  <Icon name={s.icon} size={20} className="text-accent-strong" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <AppearanceSection />
          <ProcessingSection providers={providers} />
          <ModelsSection providers={providers} />
          <AccessSection />
          <ConfigSection />
          <DataSection />
          <GmailSection />
          <ConnectionsSection />
          <AccountSection />

          {/* Deliberately not a SectionCard and not in the nav above — this is an internal
              tool for the team/judges, not a product page. See UI_GUIDE.md §2.10. */}
          <p className="px-1 text-xs text-fg-faint">
            <Link href="/features/devmode" className="underline decoration-dotted underline-offset-2 hover:text-fg-muted">
              Developer mode
            </Link>{" "}
            — reset or restore the shared database. Internal tool, not part of the product.
          </p>
        </div>
      </div>
    </div>
  );
}
