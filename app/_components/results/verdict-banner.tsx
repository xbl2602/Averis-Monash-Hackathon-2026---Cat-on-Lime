import { Icon } from "../icon";
import type { ComparisonStatus } from "../../_lib/contracts";
import { fieldLabel, reasonLabel } from "../../_lib/labels";

const LOOK = {
  OK: { title: "Every field matches", tone: "bg-ok-soft", disc: "bg-ok", anim: "animate-pop" },
  MISMATCH: { title: "The documents disagree", tone: "bg-bad-soft", disc: "bg-bad", anim: "animate-shake" },
  NEEDS_REVIEW: { title: "A person needs to look", tone: "bg-warn-soft", disc: "bg-warn", anim: "animate-pop" },
} as const;

/** The headline verdict of a comparison: a big coloured disc that pops (match), shakes (mismatch) or pulses (unsure). */
export function VerdictBanner({ status, defectFields, reason }: { status: ComparisonStatus; defectFields: string[]; reason: string | null }) {
  const look = LOOK[status];
  return (
    <div className={`${look.anim} ${look.tone} relative flex items-center gap-5 overflow-hidden rounded-3xl p-5 sm:p-6`}>
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        {status !== "OK" && <span className={`absolute inset-0 animate-ping-soft rounded-full ${look.disc} opacity-40`} />}
        <span className={`relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg ${look.disc}`}>
          {status === "OK" ? (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="animate-draw" strokeDasharray="30" d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <Icon name={status === "MISMATCH" ? "swap" : "alert"} size={32} />
          )}
        </span>
      </span>
      <div className="min-w-0">
        <div className="text-xl font-extrabold sm:text-2xl">{look.title}</div>
        <div className="mt-1 text-sm text-fg-muted">
          {status === "OK" && "Nothing differs between the SI and the BL."}
          {status === "MISMATCH" && `${defectFields.length} ${defectFields.length === 1 ? "field differs" : "fields differ"}: ${defectFields.map(fieldLabel).join(", ")}.`}
          {status === "NEEDS_REVIEW" && (reasonLabel(reason) || "The system could not decide.")}
        </div>
      </div>
    </div>
  );
}
