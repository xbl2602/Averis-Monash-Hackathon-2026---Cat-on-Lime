import { Icon, type IconName } from "../icon";

const STEPS: { icon: IconName; label: string; sub: string }[] = [
  { icon: "mail", label: "Classify", sub: "What kind of email?" },
  { icon: "list", label: "Extract", sub: "Read the 7 fields" },
  { icon: "compare", label: "Compare", sub: "SI against BL" },
];

export type FlowState = "idle" | "running" | "done" | "failed";

/**
 * The three pipeline steps as a row of nodes. While running, dashes stream along the links and each node
 * pulses in turn; when done, the nodes turn green one after another. It shows activity, not measured progress:
 * the request is a single call, so no per-step timing is claimed.
 */
export function PipelineFlow({ state }: { state: FlowState }) {
  const running = state === "running";
  const done = state === "done";
  const failed = state === "failed";

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4" role="img" aria-label={`Pipeline: ${state}`}>
      {STEPS.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span
              style={{ animationDelay: running ? `${i * 0.35}s` : `${i * 0.18}s` }}
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors duration-500 sm:h-16 sm:w-16 ${
                done ? "animate-pop border-transparent bg-ok text-white" : failed ? "border-transparent bg-bad text-white" : running ? "animate-float border-accent bg-accent/15 text-accent-strong" : "border-line bg-sunken text-fg-muted"
              }`}
            >
              {running && <span className="absolute inset-0 animate-ping-soft rounded-2xl bg-accent/30" style={{ animationDelay: `${i * 0.35}s` }} />}
              <Icon name={done ? "check" : failed ? "x" : step.icon} size={26} className="relative" />
            </span>
            <span className="text-xs font-bold">{step.label}</span>
            <span className="hidden text-[10px] text-fg-faint sm:block">{step.sub}</span>
          </div>
          {i < STEPS.length - 1 && (
            <svg width="56" height="12" viewBox="0 0 56 12" className="mb-8 shrink-0 sm:w-20" aria-hidden="true">
              <line x1="2" y1="6" x2="54" y2="6" stroke={done ? "var(--ok)" : "var(--line-strong)"} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 6" className={running ? "animate-flow" : ""} />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
