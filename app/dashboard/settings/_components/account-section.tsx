"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../../../_components/icon";
import { resetAllPreferences } from "../../../_components/prefs";
import { SectionCard, SettingRow } from "./section-card";

export function AccountSection() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    resetAllPreferences();
    setConfirming(false);
    setDone(true);
    window.setTimeout(() => setDone(false), 2500);
  }

  return (
    <SectionCard
      id="account"
      icon="user"
      title="Account and data"
      description="This demo has no real sign-in yet, so there is one shared demo account."
    >
      <SettingRow label="Signed in as" hint="Sign-in is a preview only. Anyone can open the app.">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-royal text-white">
            <Icon name="user" size={22} />
          </span>
          <div className="text-sm">
            <div className="font-semibold">Demo account</div>
            <div className="text-xs text-fg-faint">demo@shipping-doc.local</div>
          </div>
        </div>
      </SettingRow>
      <SettingRow label="Sign out" hint="Returns to the sign-in page.">
        <Link href="/login" className="btn btn-glass !py-2.5">
          <Icon name="logout" size={16} />
          Sign out
        </Link>
      </SettingRow>
      <SettingRow
        label="Reset preferences"
        hint="Clears the theme, motion and processing defaults saved in this browser. Results already stored are not affected."
      >
        {confirming ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={reset} className="btn !bg-bad !py-2.5 text-white">
              <Icon name="trash" size={16} />
              Yes, reset
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-glass !py-2.5">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="btn btn-glass !py-2.5">
            <Icon name="refresh" size={16} />
            {done ? "Preferences reset" : "Reset preferences"}
          </button>
        )}
      </SettingRow>
    </SectionCard>
  );
}
