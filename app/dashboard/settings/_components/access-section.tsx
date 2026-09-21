"use client";

import { useAdmin } from "../../../_components/admin/admin-provider";
import { UnlockForm } from "../../../_components/admin/unlock-form";
import { Icon } from "../../../_components/icon";
import { Badge } from "../../../_components/results/badges";
import { SectionCard, SettingRow } from "./section-card";

/** Explains and controls write access: everyone can look, changing anything needs the admin token. */
export function AccessSection() {
  const { unlocked, lock } = useAdmin();

  return (
    <SectionCard id="access" icon="lock" title="Write access" description="Anyone can view results. Saving, reviewing, uploading and changing settings need the admin token.">
      <SettingRow label="This tab" hint="Access lasts until you lock it, reload or close the tab.">
        <Badge tone={unlocked ? "ok" : "muted"} icon={unlocked ? "unlock" : "lock"}>{unlocked ? "Write access on" : "Read-only"}</Badge>
      </SettingRow>
      <SettingRow label={unlocked ? "Lock it again" : "Unlock"} hint={unlocked ? "Do this when you step away from a shared screen." : "Ask whoever runs this server for the token."}>
        {unlocked ? (
          <button type="button" onClick={lock} className="btn btn-glass !py-2">
            <Icon name="lock" size={16} />
            Lock now
          </button>
        ) : (
          <div className="w-full sm:w-[26rem]">
            <UnlockForm />
          </div>
        )}
      </SettingRow>
      <SettingRow label="How the token is handled" hint="It is held in this tab's memory only, sent only to the server's write endpoints, and checked there every time. It is never saved in the browser, shown again, or added to a request for you.">
        <span className="chip !px-3.5 !py-1.5">
          <Icon name="shield" size={15} className="text-ok" />
          Never stored
        </span>
      </SettingRow>
    </SectionCard>
  );
}
