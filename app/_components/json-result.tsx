/** Read-only JSON output block used by the single-step feature pages. */
export function JsonResult({ label = "Result", data }: { label?: string; data: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-code">
      <div className="border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-fg-faint">{label}</div>
      <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed">{data}</pre>
    </div>
  );
}
