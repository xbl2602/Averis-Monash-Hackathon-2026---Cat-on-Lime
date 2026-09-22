"use client";

import Link from "next/link";
import { useState } from "react";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { PipelineFlow, type FlowState } from "../../../_components/pipeline/pipeline-flow";
import { PairResults } from "../../../_components/results/pair-results";
import { postJson } from "../../../_lib/api-client";
import type { SandboxResult } from "../../../_lib/contracts";
import { fileToBase64 } from "../../../_lib/format";
import type { ProviderOption } from "../../../_lib/provider-options";
import { DropZone } from "./drop-zone";
import { EXAMPLE_BODY, EXAMPLE_SUBJECT, exampleFiles } from "./example-docs";

export function SandboxWorkbench({ providers }: { providers: ProviderOption[] }) {
  const [si, setSi] = useState<File | null>(null);
  const [bl, setBl] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [provider, setProvider] = useState("");
  const [flow, setFlow] = useState<FlowState>("idle");
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const ready = si !== null && bl !== null && flow !== "running";

  function useExample() {
    const example = exampleFiles();
    setSi(example.si);
    setBl(example.bl);
    setSubject(EXAMPLE_SUBJECT);
    setBody(EXAMPLE_BODY);
    setResult(null);
    setError(null);
    setFlow("idle");
  }

  async function run() {
    if (!si || !bl) return;
    setFlow("running");
    setError(null);
    setResult(null);
    try {
      const [siData, blData] = await Promise.all([fileToBase64(si), fileToBase64(bl)]);
      const response = await postJson<SandboxResult>("/features/sandbox/api", {
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(body.trim() ? { body: body.trim() } : {}),
        si: { name: si.name, data_base64: siData },
        bl: { name: bl.name, data_base64: blData },
        ...(provider ? { provider } : {}),
      });
      if (!response.ok) {
        setError(response.error);
        setFlow("failed");
        return;
      }
      setResult(response.data);
      setFlow("done");
    } catch {
      setError({ message: "One of the files could not be read in your browser. Try selecting it again." });
      setFlow("failed");
    }
  }

  return (
    <div className="space-y-8">
      <div className="card space-y-6 p-5 sm:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <DropZone label="Shipping Instruction (SI)" tag="Reference" file={si} onFile={setSi} />
          <DropZone label="Draft Bill of Lading (BL)" tag="To be checked" file={bl} onFile={setBl} />
        </div>

        <details className="group rounded-2xl border border-line bg-sunken">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold">
            <Icon name="mail" size={18} className="text-accent-strong" />
            Add the email text too (optional, also classifies it)
            <Icon name="chevronDown" size={16} className="ml-auto text-fg-faint transition group-open:rotate-180" />
          </summary>
          <div className="grid gap-3 px-4 pb-4">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Email subject" className="field" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Body" aria-label="Email body" className="field field-area resize-y" />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={run} disabled={!ready} className="btn btn-primary btn-shine !px-8 !py-3">
            <Icon name="play" size={17} />
            {flow === "running" ? "Checking…" : "Check these documents"}
          </button>
          <button type="button" onClick={useExample} className="btn btn-glass !py-3">
            <Icon name="sparkles" size={17} />
            Use example documents
          </button>
        </div>

        <details className="group rounded-2xl border border-line bg-sunken">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold">
            <Icon name="sliders" size={18} className="text-accent-strong" />
            Advanced options
            <Icon name="chevronDown" size={16} className="ml-auto text-fg-faint transition group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            <label className="block max-w-sm text-sm">
              <span className="mb-1.5 block text-xs font-semibold text-fg-muted">Language model to use</span>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="field">
                <option value="">Automatic (recommended)</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.ready ? "" : p.localOnly ? " · local only" : " · key missing"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>

        <div className="flex items-center gap-2 text-xs text-fg-faint">
          <Icon name="shield" size={15} className="text-ok" />
          Nothing is saved and no database is needed. The files are read, checked and thrown away.
          <Link href="/features/import" className="ml-1 font-semibold text-accent-strong underline-offset-2 hover:underline">
            Already uploaded some? Check a pair from the pool
          </Link>
        </div>
      </div>

      {flow !== "idle" && (
        <div className="card animate-rise p-6 sm:p-8">
          <PipelineFlow state={flow} />
        </div>
      )}

      {error && <ErrorNotice error={error} />}
      {result && <PairResults result={result} />}
    </div>
  );
}
