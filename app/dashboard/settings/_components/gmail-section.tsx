"use client";

import { useState } from "react";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { Icon } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import { Badge } from "../../../_components/results/badges";
import { useToast } from "../../../_components/toast";
import type { GmailConnection } from "../../../_lib/contracts";
import { relativeTime } from "../../../_lib/format";
import { useApi } from "../../../_lib/use-api";
import { SectionCard, SettingRow } from "./section-card";

interface ConnectPlaceholder {
  status: "not_implemented";
  message: string;
  redirect_uri: string;
}

const STATUS_TONE = { connected: "ok", pending: "info", error: "bad", disconnected: "muted" } as const;

/**
 * Gmail: the status and the plumbing are real, but signing in to Google is not built yet, and this section says so
 * plainly instead of offering a button that pretends to work.
 */
export function GmailSection() {
  const { data, databaseDown, reload } = useApi<GmailConnection>("/features/mail/api/gmail");
  const { unlocked, adminRequest } = useAdmin();
  const toast = useToast();
  const [placeholder, setPlaceholder] = useState<ConnectPlaceholder | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    const result = await adminRequest<ConnectPlaceholder>("/features/mail/api/gmail/connect", { method: "POST" });
    setBusy(false);
    if (result.ok) setPlaceholder(result.data);
    else if (result.status !== 401 && result.status !== 403) toast({ tone: "bad", title: "That did not work", detail: result.error.message });
  }

  async function disconnect() {
    setBusy(true);
    const result = await adminRequest<unknown>("/features/mail/api/gmail/disconnect", { method: "POST" });
    setBusy(false);
    if (result.ok) {
      toast({ tone: "ok", title: "Gmail disconnected" });
      reload();
    } else if (result.status !== 401 && result.status !== 403) {
      toast({ tone: "bad", title: "Could not disconnect", detail: result.error.message });
    }
  }

  const status = data?.status ?? "disconnected";

  return (
    <SectionCard id="mail" icon="mail" title="Gmail" description="Pull emails straight from an inbox into the pipeline.">
      <SettingRow label="Connection" hint="Signing in with Google is not built yet, so nothing can be connected today.">
        {databaseDown ? <Badge tone="muted" icon="database">No database</Badge> : <Badge tone={STATUS_TONE[status]} icon={status === "connected" ? "checkCircle" : "clock"}>{status === "disconnected" ? "Not connected" : status}</Badge>}
      </SettingRow>
      {data?.email_address && (
        <SettingRow label="Account" hint={data.last_synced_at ? `Last synced ${relativeTime(data.last_synced_at)}` : "Never synced"}>
          <span className="font-mono text-xs">{data.email_address}</span>
        </SettingRow>
      )}
      <SettingRow label="Actions" hint={unlocked ? "These need write access, which is on." : "These need write access. Unlock it in the top bar."}>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!unlocked || busy} onClick={() => void connect()} className="btn btn-glass !py-2">
            <Icon name="link" size={16} />
            What is needed to connect
          </button>
          {status !== "disconnected" && (
            <button type="button" disabled={!unlocked || busy} onClick={() => void disconnect()} className="btn btn-glass !py-2">
              <Icon name="power" size={16} />
              Disconnect
            </button>
          )}
        </div>
      </SettingRow>
      {placeholder && (
        <div className="animate-rise pt-5">
          <Notice tone="info" title="Not available yet">
            <p>{placeholder.message}</p>
            <p className="mt-2 break-all font-mono text-xs text-fg-faint">Redirect URI to register: {placeholder.redirect_uri}</p>
          </Notice>
        </div>
      )}
    </SectionCard>
  );
}
