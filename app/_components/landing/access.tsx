import { Icon, type IconName } from "../icon";
import { Reveal } from "../reveal";

const REST_SNIPPET = `curl -X POST https://<your-host>/features/classification/api \\
  -H "Content-Type: application/json" \\
  -d '{ "email_id": "email_004" }'`;

const MCP_SNIPPET = `{
  "mcpServers": {
    "shipping-doc-verifier": {
      "url": "https://<your-host>/core/mcp-server"
    }
  }
}`;

const MCP_TOOLS = [
  "classify_email",
  "extract_document_fields",
  "compare_documents",
  "run_batch",
  "list_results",
  "export_results",
];

const SURFACES: { icon: IconName; title: string; text: string }[] = [
  { icon: "laptop", title: "Web app", text: "A responsive interface for operations teams. Works on desktop and phone browsers." },
  { icon: "code", title: "REST API", text: "Plain HTTP endpoints for classification, extraction, comparison, batch runs and results." },
  {
    icon: "plug",
    title: "MCP server",
    text: "The same capabilities as MCP tools, over streamable HTTP, for Claude Desktop and other AI agents.",
  },
];

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-code">
      <div className="border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-fg-faint">
        {label}
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-fg">{code}</pre>
    </div>
  );
}

export function Access() {
  return (
    <section id="access" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
      <Reveal>
        <span className="eyebrow">Use it your way</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">One engine, three ways in.</h2>
        <p className="mt-4 max-w-2xl text-fg-muted">
          The web app, the REST API and the MCP server all run the same verification logic, so a result is the same
          wherever you ask for it.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {SURFACES.map((s, i) => (
          <Reveal key={s.title} delay={i * 100}>
            <div className="card card-hover h-full p-7">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
                <Icon name={s.icon} size={28} />
              </span>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={150}>
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <CodeBlock label="REST · classify one email" code={REST_SNIPPET} />
            <p className="px-1 text-xs text-fg-muted">
              Read endpoints are open. Anything that writes results needs an admin token; public batch runs are
              preview-only.
            </p>
          </div>
          <div className="min-w-0 space-y-3">
            <CodeBlock label="MCP · client config" code={MCP_SNIPPET} />
            <div className="flex flex-wrap gap-2 px-1">
              {MCP_TOOLS.map((t) => (
                <span key={t} className="chip font-mono !text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
