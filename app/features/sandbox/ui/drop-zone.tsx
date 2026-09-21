"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "../../../_components/icon";
import { formatBytes } from "../../../_lib/format";

export const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const ALLOWED = ["txt", "md", "pdf", "docx", "xlsx"];

/** Returns a readable problem with the file, or null when it can be sent. Mirrors the server's rules so people find out before uploading. */
export function checkFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED.includes(ext)) return `“.${ext}” files are not supported. Use ${ALLOWED.map((e) => "." + e).join(", ")}.`;
  if (file.size > MAX_FILE_BYTES) return `That file is ${formatBytes(file.size)}. The limit is 1.5 MB.`;
  if (file.size === 0) return "That file is empty.";
  return null;
}

/** One big drop target for a single document. Drag a file on, or click to browse. */
export function DropZone({ label, tag, file, onFile }: { label: string; tag: string; file: File | null; onFile: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function take(next: File | undefined) {
    if (!next) return;
    const issue = checkFile(next);
    setProblem(issue);
    if (!issue) onFile(next);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setHover(false);
    take(event.dataTransfer.files[0]);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}: choose or drop a file`}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        className={`group relative flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition duration-300 ${
          hover ? "scale-[1.02] border-accent bg-accent/10" : file ? "border-ok/50 bg-ok-soft" : "border-line-strong bg-sunken hover:border-accent hover:bg-accent/[0.06]"
        }`}
      >
        <input ref={input} type="file" accept=".txt,.md,.pdf,.docx,.xlsx" className="sr-only" tabIndex={-1} onChange={(e) => take(e.target.files?.[0])} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-faint">{tag}</span>
        {file ? (
          <>
            <span className="animate-pop flex h-14 w-14 items-center justify-center rounded-2xl bg-ok text-white">
              <Icon name="check" size={28} />
            </span>
            <div className="min-w-0 max-w-full">
              <div className="truncate text-sm font-bold">{file.name}</div>
              <div className="text-xs text-fg-muted">{formatBytes(file.size)}</div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
                setProblem(null);
              }}
              className="btn btn-glass !px-4 !py-1.5 !text-xs"
            >
              <Icon name="x" size={14} />
              Remove
            </button>
          </>
        ) : (
          <>
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong transition duration-300 ${hover ? "-translate-y-2 scale-110" : "group-hover:-translate-y-1"}`}>
              <Icon name="upload" size={28} />
            </span>
            <div>
              <div className="text-sm font-bold">{label}</div>
              <div className="mt-1 text-xs text-fg-muted">Drop a file here, or click to browse</div>
              <div className="mt-1 text-[11px] text-fg-faint">.txt .md .pdf .docx .xlsx · up to 1.5 MB</div>
            </div>
          </>
        )}
      </div>
      {problem && (
        <p role="alert" className="animate-shake mt-2 text-xs font-medium text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}
