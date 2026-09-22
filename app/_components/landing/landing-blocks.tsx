import { AccuracyStats } from "../accuracy-stats";
import { Icon } from "../icon";
import { ACCESS_INTRO, ACCURACY_INTRO, HOW_IT_WORKS, SURFACES } from "./content";
import { SceneEyebrow } from "./scene-shell";

/**
 * The plain content blocks of the final scene. They carry data-rise: in the story each one is
 * scrubbed in by scroll (and back out when you scroll up); elsewhere they are just there.
 * data-avoid marks the text the plane must fade out of the way of while it flies in to land.
 */

/** Measured accuracy: real figures from scoring every sample email against the answer key, with the scope stated next to them. */
export function AccuracyBlock() {
  return (
    // In the story, the closing block's first 100vh is overlapped by the still-pinned workspace scene (.scene has
    // margin-bottom:-100vh) and is faded out there, so a plain jump to #accuracy would land on a blank screen.
    // The extra top padding keeps the heading clear of that zone, and data-jump scrolls a fifth of a screen further
    // so the menu lands on the finished section. Measured safe from 0.15 upwards at 768-1080px tall.
    <section id="accuracy" data-jump="0.2" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-6 pt-24 story:pt-[25vh]">
      <div data-rise data-avoid className="mb-10">
        <SceneEyebrow>{ACCURACY_INTRO.eyebrow}</SceneEyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">{ACCURACY_INTRO.heading}</h2>
        <p className="mt-4 max-w-2xl text-fg-muted">{ACCURACY_INTRO.text}</p>
      </div>
      <AccuracyStats variant="landing" />
    </section>
  );
}

/** Web / REST / MCP: three lanes running off a landing strip. Short and plain: this is for people choosing a way in, not for developers. */
export function AccessBlock() {
  return (
    <section id="access" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-16 pt-20">
      <div data-rise data-avoid>
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
            <div key={s.title} data-rise data-avoid className="card card-hover h-full p-7">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
                <Icon name={s.icon} size={28} />
              </span>
              <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksBlock() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 pt-12">
      <div data-rise data-avoid>
        <SceneEyebrow>{HOW_IT_WORKS.eyebrow}</SceneEyebrow>
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{HOW_IT_WORKS.heading}</h2>
      </div>
      <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
        <div className="absolute left-0 right-0 top-6 hidden h-px bg-line sm:block" />
        {HOW_IT_WORKS.steps.map((s) => (
          <div key={s.step} data-rise data-avoid className="relative">
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
