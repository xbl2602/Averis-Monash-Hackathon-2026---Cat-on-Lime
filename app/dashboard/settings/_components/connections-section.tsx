"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "../../../_components/icon";
import { SectionCard, SettingRow } from "./section-card";

const noopSubscribe = () => () => {};

/** This deployment's own address, so the copied URLs work wherever the app is running. */
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "https://<your-host>"
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (non-secure page); the URL stays selectable in the field.
    }
  }

  return (
    <div className="flex w-full items-center gap-2 sm:w-[26rem]">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="field font-mono !text-xs" />
      <button type="button" onClick={copy} className="btn btn-glass shrink-0 !px-4 !py-2.5" aria-label={`Copy ${label}`}>
        <Icon name={copied ? "check" : "copy"} size={16} className={copied ? "text-ok" : ""} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function ConnectionsSection() {
  const origin = useOrigin();

  return (
    <SectionCard
      id="connections"
      icon="plug"
      title="Connections"
      description="Use the same verification engine from your own code or from an AI agent."
    >
      <SettingRow label="REST API base URL" hint="Endpoints live under /features/<module>/api. Open one in the browser for usage notes.">
        <CopyField label="REST API base URL" value={`${origin}/features`} />
      </SettingRow>
      <SettingRow label="MCP server URL" hint="Streamable HTTP. Add it as a remote server in Claude Desktop or any MCP client.">
        <CopyField label="MCP server URL" value={`${origin}/core/mcp-server`} />
      </SettingRow>
    </SectionCard>
  );
}
