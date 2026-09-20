"use client";

import { Icon } from "../../../_components/icon";
import { DEFAULT_LIMIT, DEFAULT_PROVIDER, LIMIT_PREF_KEY, PROVIDER_PREF_KEY, usePref } from "../../../_components/prefs";
import type { ProviderOption } from "../../../_lib/provider-options";
import { SectionCard, SettingRow } from "./section-card";

export function ProcessingSection({ providers }: { providers: ProviderOption[] }) {
  const [provider, setProvider] = usePref(PROVIDER_PREF_KEY, DEFAULT_PROVIDER);
  const [limit, setLimit] = usePref(LIMIT_PREF_KEY, DEFAULT_LIMIT);
  const textProviders = providers.filter((p) => p.textCapable);

  return (
    <SectionCard
      id="processing"
      icon="sliders"
      title="Processing defaults"
      description="Starting values for the Full pipeline page. You can still change them for each run."
    >
      <SettingRow label="Fallback model" hint="Used when the rules can't settle a field. Rules always run first.">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="field sm:w-72"
          aria-label="Fallback model"
        >
          {textProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
              {p.ready ? "" : p.localOnly ? " · local only" : " · key missing"}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="Emails per run" hint="How many emails one pipeline run should process (1 to 20 in preview mode).">
        <div className="flex items-center gap-4 sm:w-72">
          <input
            type="range"
            min={1}
            max={20}
            value={Number(limit)}
            onChange={(e) => setLimit(e.target.value)}
            aria-label="Emails per run"
            className="h-2 w-full cursor-pointer accent-[var(--accent)]"
          />
          <span className="w-8 text-right font-mono text-sm font-semibold">{limit}</span>
        </div>
      </SettingRow>
      <SettingRow
        label="Preview mode"
        hint="Public runs only calculate results. Saving them to the database needs an admin token, so this can't be switched off here."
      >
        <span className="chip !px-3.5 !py-1.5">
          <Icon name="shield" size={15} className="text-ok" />
          Always on
        </span>
      </SettingRow>
    </SectionCard>
  );
}
