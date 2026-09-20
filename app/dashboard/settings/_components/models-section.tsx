import type { ProviderOption } from "../../../_lib/provider-options";
import { SectionCard, SettingRow } from "./section-card";

function statusOf(p: ProviderOption): { text: string; tone: string } {
  if (p.ready) return { text: "Ready", tone: "bg-ok-soft text-ok" };
  if (p.localOnly) return { text: "Local only", tone: "bg-warn-soft text-warn" };
  return { text: "Key missing", tone: "bg-warn-soft text-warn" };
}

/** Read-only: keys live in server environment variables and are never shown or edited from the browser. */
export function ModelsSection({ providers }: { providers: ProviderOption[] }) {
  return (
    <SectionCard
      id="models"
      icon="cpu"
      title="Models"
      description="Which language models this deployment can use right now. Keys are set on the server, never in the browser."
    >
      {providers.map((p) => {
        const status = statusOf(p);
        return (
          <SettingRow
            key={p.id}
            label={p.label}
            hint={p.localOnly ? "Works only when the app runs on the same machine as LM Studio." : undefined}
          >
            <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold ${status.tone}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {status.text}
            </span>
          </SettingRow>
        );
      })}
    </SectionCard>
  );
}
