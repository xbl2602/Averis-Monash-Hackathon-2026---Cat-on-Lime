import { Icon } from "../icon";
import { REPORT } from "./content";

/** The discrepancy report card (hero). The comparison scene builds its own animated version from the same REPORT data. */
export function ReportPreview() {
  return (
    <div className="card overflow-hidden p-2 sm:p-3">
      <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2 sm:px-4">
        <div className="min-w-0">
          <div className="eyebrow">{REPORT.eyebrow}</div>
          <div className="mt-1 truncate text-sm font-semibold">{REPORT.subject}</div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bad-soft px-3 py-1 text-xs font-semibold text-bad">
          <Icon name="alert" size={13} />
          {REPORT.badge}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-sunken">
        <table className="w-full min-w-[420px] text-left text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-fg-faint">
              <th className="px-4 py-2.5 font-medium">Field</th>
              <th className="px-3 py-2.5 font-medium">SI (reference)</th>
              <th className="px-3 py-2.5 font-medium">Draft BL</th>
              <th className="w-8 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {REPORT.rows.map((r) => (
              <tr key={r.field} className={r.ok ? "border-t border-line" : "border-t border-line bg-bad-soft"}>
                <td className="px-4 py-2.5 font-medium">{r.field}</td>
                <td className="px-3 py-2.5 text-fg-muted">{r.si}</td>
                <td className={`px-3 py-2.5 ${r.ok ? "text-fg-muted" : "font-bold text-bad"}`}>{r.bl}</td>
                <td className="px-3 py-2.5">
                  {r.ok ? (
                    <Icon name="check" size={15} className="text-ok" />
                  ) : (
                    <Icon name="alert" size={15} className="text-bad" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 pt-3 text-xs text-fg-muted sm:px-4">
        <span>
          <strong className="text-bad">Flag:</strong> Container count — SI: 3 / BL: 4
        </span>
        <span className="text-fg-faint">{REPORT.formattingNote}</span>
      </div>
    </div>
  );
}
