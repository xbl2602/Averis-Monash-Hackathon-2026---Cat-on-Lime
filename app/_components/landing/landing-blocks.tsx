import { Icon } from "../icon";
import {
  ACCESS_INTRO,
  DEPLOYMENTS,
  DEPLOY_COPY,
  HOW_IT_WORKS,
  MCP_SNIPPET,
  MCP_TOOLS,
  MODELS,
  MODELS_COPY,
  REST_SNIPPET,
  SURFACES,
} from "./content";
import { SceneEyebrow } from "./scene-shell";

/**
 * The plain content blocks of the final scene. They carry data-rise: in the story each one is
 * scrubbed in by scroll (and back out when you scroll up); elsewhere they are just there.
 */

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

/** Web / REST / MCP: three lanes running off a landing strip */
export function AccessBlock() {
  return (
    <section id="access" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-20 pt-24">
      <div data-rise>
        <SceneEyebrow>{ACCESS_INTRO.eyebrow}</SceneEyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">{ACCESS_INTRO.heading}</h2>
        <p className="mt-4 max-w-2xl text-fg-muted">{ACCESS_INTRO.text}</p>
      </div>

      <div className="relative mt-10">
        {/* The landing strip and its three lanes (story only): drawn by scroll, one lane per way in */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-6 hidden h-6 story:block">
          <div data-runway className="absolute left-[16.6%] right-[16.6%] top-0 h-[2px] origin-left rounded-full bg-accent" />
          {[16.6, 50, 83.3].map((left) => (
            <div
              key={left}
              data-lane-drop
              className="absolute top-0 h-6 w-[2px] origin-top -translate-x-1/2 rounded-full bg-accent"
              style={{ left: `${left}%` }}
            />
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {SURFACES.map((s) => (
            <div key={s.title} data-rise className="card card-hover h-full p-7">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
                <Icon name={s.icon} size={28} />
              </span>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div data-rise className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <CodeBlock label="REST · classify one email" code={REST_SNIPPET} />
          <p className="px-1 text-xs text-fg-muted">{ACCESS_INTRO.restNote}</p>
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
    </section>
  );
}

export function ModelsDeployBlock() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-5 lg:grid-cols-2">
        <div data-rise className="card h-full p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
            <Icon name="cpu" size={28} />
          </span>
          <h2 className="mt-5 text-2xl font-bold">{MODELS_COPY.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{MODELS_COPY.text}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {MODELS.map((m) => (
              <span key={m} className="chip !px-3.5 !py-1.5 !text-[13px]">
                {m}
              </span>
            ))}
          </div>
        </div>

        <div data-rise className="card h-full p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
            <Icon name="server" size={28} />
          </span>
          <h2 className="mt-5 text-2xl font-bold">{DEPLOY_COPY.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{DEPLOY_COPY.text}</p>
          <ul className="mt-5 space-y-3">
            {DEPLOYMENTS.map((d) => (
              <li key={d.title} className="flex items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunken text-fg">
                  <Icon name={d.icon} size={20} />
                </span>
                <div className="text-sm">
                  <span className="font-semibold">{d.title}.</span> <span className="text-fg-muted">{d.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function HowItWorksBlock() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 pt-8">
      <div data-rise>
        <SceneEyebrow>{HOW_IT_WORKS.eyebrow}</SceneEyebrow>
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{HOW_IT_WORKS.heading}</h2>
      </div>
      <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
        <div className="absolute left-0 right-0 top-6 hidden h-px bg-line sm:block" />
        {HOW_IT_WORKS.steps.map((s) => (
          <div key={s.step} data-rise className="relative">
            <div className="card flex h-12 w-12 items-center justify-center !rounded-full font-mono text-sm font-bold text-accent-strong">
              {s.step}
            </div>
            <h3 className="mt-4 font-bold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
