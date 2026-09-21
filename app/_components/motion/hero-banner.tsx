import type { ReactNode } from "react";

/**
 * Feature-page hero: a glass panel with drifting colour blobs, a fading grid and a rotating light edge.
 * Pure markup and CSS, so it is safe in server components. `aside` sits to the right on wide screens.
 */
export function HeroBanner({
  eyebrow,
  title,
  highlight,
  description,
  actions,
  aside,
}: {
  eyebrow: string;
  title: string;
  /** Last words of the title, shown with the gradient */
  highlight?: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="card glow-border relative overflow-hidden p-6 sm:p-9">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="orb -left-16 -top-24 h-72 w-72 animate-drift-a bg-[var(--orb-1)]" />
        <div className="orb -bottom-28 right-10 h-80 w-80 animate-drift-b bg-[var(--orb-2)]" />
        <div className="orb right-1/3 top-4 h-52 w-52 animate-drift-c bg-[var(--orb-3)]" />
        <div
          className="grid-fade-mask absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <span className="eyebrow animate-rise">{eyebrow}</span>
          <h1 className="animate-rise stagger mt-3 text-3xl font-extrabold leading-[1.1] sm:text-5xl" style={{ "--i": 1 } as React.CSSProperties}>
            {title} {highlight && <span className="text-gradient">{highlight}</span>}
          </h1>
          <p className="animate-rise stagger mt-4 max-w-xl text-sm leading-relaxed text-fg-muted sm:text-base" style={{ "--i": 2 } as React.CSSProperties}>
            {description}
          </p>
          {actions && (
            <div className="animate-rise stagger mt-6 flex flex-wrap items-center gap-3" style={{ "--i": 3 } as React.CSSProperties}>
              {actions}
            </div>
          )}
        </div>
        {aside && (
          <div className="animate-pop stagger min-w-0" style={{ "--i": 2 } as React.CSSProperties}>
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
