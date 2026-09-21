import { Icon } from "../icon";
import type { ExtractedDocumentEvidence } from "../../_lib/contracts";

/**
 * Where a value came from. Rule-based fields point at the source line ("Line 3") with the original
 * sentence in a tooltip; model-filled fields say so, because they have no line to point at.
 */
export function EvidenceChip({
  evidence,
  alignEnd = false,
}: {
  evidence: ExtractedDocumentEvidence[keyof ExtractedDocumentEvidence] | undefined;
  /** Open the tooltip towards the left on wide screens; for chips near the right edge of a container */
  alignEnd?: boolean;
}) {
  if (!evidence) return null;
  const fromRules = evidence.source === "rules";
  const label = fromRules ? (evidence.line ? `Line ${evidence.line}` : "Rules") : "Model";

  return (
    <span tabIndex={0} className="group/ev relative inline-flex outline-none">
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-sunken px-2 py-0.5 font-mono text-[10px] text-fg-faint transition group-hover/ev:border-line-strong group-hover/ev:text-fg-muted group-focus/ev:border-accent">
        <Icon name={fromRules ? "file" : "sparkles"} size={11} />
        {label}
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-max max-w-[min(16rem,calc(100vw-3rem))] scale-95 ${alignEnd ? "sm:left-auto sm:right-0" : ""} rounded-xl border border-line bg-surface-solid px-3 py-2 text-left text-[11px] leading-snug text-fg-muted opacity-0 shadow-xl transition group-hover/ev:scale-100 group-hover/ev:opacity-100 group-focus/ev:scale-100 group-focus/ev:opacity-100`}
      >
        {fromRules && evidence.text ? (
          <>
            <span className="block font-mono text-[10px] uppercase tracking-wider text-fg-faint">Source, line {evidence.line}</span>
            <span className="mt-0.5 block break-words font-mono text-fg">{evidence.text}</span>
          </>
        ) : (
          <>Filled in by the language model. There is no source line to point at.</>
        )}
      </span>
    </span>
  );
}
