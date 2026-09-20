"use client";

import { MOTION_KEY, useTheme, type Theme } from "../../../_components/theme";
import { usePref } from "../../../_components/prefs";
import { ThemeToggle } from "../../../_components/theme-toggle";
import { SectionCard, SettingRow } from "./section-card";
import { Switch } from "./switch";

// The preview thumbnails always show their own theme's colours, so they use fixed values on purpose
const PREVIEWS: Record<Theme, { page: string; card: string; bar: string; line: string }> = {
  light: { page: "#eef1f6", card: "#ffffff", bar: "#0a7cff", line: "#d8dde8" },
  dark: { page: "#120e24", card: "#1c1633", bar: "#5b4fe8", line: "#3a3160" },
};

function ThemePreviewCard({ theme, selected, onSelect }: { theme: Theme; selected: boolean; onSelect: () => void }) {
  const c = PREVIEWS[theme];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group w-full rounded-2xl border p-2 text-left transition ${
        selected ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-line-strong"
      }`}
    >
      <div className="flex h-24 gap-2 rounded-xl p-2.5" style={{ background: c.page }}>
        <div className="w-1/4 rounded-lg" style={{ background: c.card }}>
          <div className="m-1.5 h-1.5 rounded-full" style={{ background: c.bar }} />
          <div className="m-1.5 h-1.5 rounded-full" style={{ background: c.line }} />
          <div className="m-1.5 h-1.5 rounded-full" style={{ background: c.line }} />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-3 w-1/2 rounded-full" style={{ background: c.bar }} />
          <div className="flex-1 rounded-lg" style={{ background: c.card }} />
        </div>
      </div>
      <div className="flex items-center justify-between px-1.5 pb-1 pt-2.5 text-sm font-semibold">
        {theme === "light" ? "Light" : "Dark"}
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
            selected ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"
          }`}
        >
          ✓
        </span>
      </div>
    </button>
  );
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [motion, setMotion] = usePref(MOTION_KEY, "full");
  const reduced = motion === "reduced";

  function updateReducedMotion(next: boolean) {
    setMotion(next ? "reduced" : "full");
    if (next) document.documentElement.setAttribute("data-motion", "reduced");
    else document.documentElement.removeAttribute("data-motion");
  }

  return (
    <SectionCard
      id="appearance"
      icon="palette"
      title="Appearance"
      description="Choose how the app looks. Your choice is remembered on this device."
    >
      <SettingRow label="Theme" hint="Light uses a soft frosted-glass look. Dark uses the deep indigo look.">
        <div role="radiogroup" aria-label="Theme" className="grid w-full grid-cols-2 gap-3 sm:w-80">
          <ThemePreviewCard theme="light" selected={theme === "light"} onSelect={() => setTheme("light")} />
          <ThemePreviewCard theme="dark" selected={theme === "dark"} onSelect={() => setTheme("dark")} />
        </div>
      </SettingRow>
      <SettingRow label="Dark mode" hint="Quick switch, the same as the toggle in the top bar.">
        <ThemeToggle size="lg" />
      </SettingRow>
      <SettingRow label="Reduce motion" hint="Turns off drifting backgrounds and slide animations.">
        <Switch checked={reduced} onChange={updateReducedMotion} label="Reduce motion" />
      </SettingRow>
    </SectionCard>
  );
}
