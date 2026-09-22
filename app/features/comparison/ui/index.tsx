"use client";

import { useState } from "react";
import { Icon, type IconName } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import type { EmailOption } from "../../../_lib/attachments";
import { CustomValues } from "./custom-values";
import { FromEmail } from "./from-email";

const TABS: { key: "email" | "custom"; icon: IconName; label: string; desc: string }[] = [
  { key: "email", icon: "mail", label: "A sample email", desc: "Read its SI and BL, then compare" },
  { key: "custom", icon: "edit", label: "My own values", desc: "Type the fields and see the verdict" },
];

export function ComparisonPanel({ emails }: { emails: EmailOption[] }) {
  const [tab, setTab] = useState<"email" | "custom">("email");

  return (
    <div className="space-y-6">
      <Notice title="How it compares">
        Case, punctuation and number formats are tidied first, so formatting quirks don&rsquo;t cause false alarms. Numbers are always compared exactly. When it can&rsquo;t decide, the result is marked <strong>Needs review</strong> for a person.
      </Notice>

      <div role="tablist" aria-label="Comparison input" className="grid gap-3 sm:grid-cols-2">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setTab(t.key)} className={`card card-hover flex items-center gap-4 p-4 text-left ${tab === t.key ? "!border-accent shadow-lg" : ""}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${tab === t.key ? "bg-accent text-white" : "bg-accent/12 text-accent-strong"}`}>
              <Icon name={t.icon} size={24} />
            </span>
            <span>
              <span className="block text-sm font-bold">{t.label}</span>
              <span className="block text-xs text-fg-muted">{t.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div key={tab} className="animate-rise">{tab === "email" ? <FromEmail emails={emails} /> : <CustomValues />}</div>
    </div>
  );
}
