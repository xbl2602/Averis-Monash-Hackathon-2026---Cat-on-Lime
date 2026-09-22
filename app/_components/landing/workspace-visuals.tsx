import { Icon } from "../icon";
import type { WorkspaceKey } from "./content";

/**
 * The little illustration on each workspace card. Every visual is plain markup in its FINISHED state; in the
 * story, pieces marked data-ws-item are scrubbed in one after another (see SceneWorkspace), so each card
 * plays a five-second micro-story as you scroll. Nothing here calls a server: they are drawings, not screens.
 */

const Mono = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`font-mono text-[10px] ${className}`}>{children}</span>
);

function Results() {
  return (
    <div className="flex h-full flex-col justify-center gap-1 px-3">
      <div data-ws-item className="flex items-center gap-2 rounded-lg bg-surface-solid px-2.5 py-1">
        <span className="h-2 w-2 rounded-full bg-ok" />
        <Mono className="text-fg-muted">email_001</Mono>
        <span className="ml-auto h-1.5 w-12 rounded-full bg-line-strong" />
      </div>
      <div data-ws-item className="rounded-lg border border-accent/40 bg-surface-solid px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-bad" />
          <Mono className="font-semibold text-fg">email_004</Mono>
          <span className="ml-auto rounded-full bg-bad-soft px-1.5 py-px text-[9px] font-semibold text-bad">Mismatch</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1.5 text-[9px] font-semibold">
          <span className="truncate rounded bg-bad-soft px-1.5 py-0.5 text-bad">EAST BRIGHT FZ-LLC</span>
          <span className="truncate rounded bg-warn-soft px-1.5 py-0.5 text-warn">UAB NOVAKOPA</span>
        </div>
      </div>
      <div data-ws-item className="flex items-center gap-2 rounded-lg bg-surface-solid px-2.5 py-1">
        <span className="h-2 w-2 rounded-full bg-ok" />
        <Mono className="text-fg-muted">email_005</Mono>
        <span className="ml-auto h-1.5 w-8 rounded-full bg-line-strong" />
      </div>
    </div>
  );
}

function Conflicts() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-3">
      <div data-ws-item className="flex items-center gap-2 text-[11px]">
        <Mono className="w-5 text-fg-faint">SI</Mono>
        <span className="font-semibold">
          NORTHWIND <mark className="diff-del">TRADING</mark> GMBH
        </span>
      </div>
      <div data-ws-item className="flex items-center gap-2 text-[11px]">
        <Mono className="w-5 text-fg-faint">BL</Mono>
        <span className="font-semibold">
          <mark className="diff-add">HANSEATIC IMPORTS</mark> GMBH
        </span>
      </div>
      <div data-ws-item className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold text-white">
          <Icon name="copy" size={11} />
          Copy request
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-1 text-[10px] font-semibold text-bad">
          3 <Icon name="arrowRight" size={10} /> 4
        </span>
      </div>
    </div>
  );
}

function Review() {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-3">
      <div data-ws-item className="rounded-lg bg-surface-solid p-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-warn/50" />
            <span className="relative h-2 w-2 rounded-full bg-warn" />
          </span>
          <span className="text-[10px] font-semibold text-warn">Needs review</span>
          <Mono className="ml-auto text-fg-faint">container count</Mono>
        </div>
      </div>
      <div data-ws-item className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-semibold text-white">
          <Icon name="check" size={11} />
          Confirm
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-1 text-[10px] font-semibold">
          <Icon name="edit" size={11} />
          Correct
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-1.5 py-1 text-[10px] font-semibold text-fg-muted">
          <Icon name="undo" size={10} />
          Undo
        </span>
      </div>
      <div data-ws-item className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-[10px] font-semibold text-ok">
        <Icon name="checkCircle" size={12} />
        Confirmed · logged
      </div>
    </div>
  );
}

function Export() {
  const rows: [string, boolean][] = [
    ["Every email is included", true],
    ["Checked against the official list", true],
    ["No out-of-date results", true],
    ["2 rows still to review", false],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-3">
      {rows.map(([label, ok]) => (
        <div key={label} data-ws-item className="flex items-center gap-2 text-[11px]">
          <span className={`flex h-4 w-4 items-center justify-center rounded-full ${ok ? "bg-ok text-white" : "bg-warn-soft text-warn"}`}>
            <Icon name={ok ? "check" : "alert"} size={10} />
          </span>
          <span className={ok ? "font-medium" : "font-semibold text-warn"}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Sandbox() {
  return (
    <div className="flex h-full items-center justify-between gap-2 px-3">
      <div className="flex flex-col gap-1.5">
        <span data-ws-item className="animate-float inline-flex items-center gap-1.5 rounded-lg bg-surface-solid px-2 py-1.5 text-[10px] font-semibold">
          <Icon name="file" size={12} className="text-accent-strong" />
          SI.pdf
        </span>
        <span data-ws-item className="animate-float inline-flex items-center gap-1.5 rounded-lg bg-surface-solid px-2 py-1.5 text-[10px] font-semibold [animation-delay:0.8s]">
          <Icon name="file" size={12} className="text-accent-strong" />
          BL.docx
        </span>
      </div>
      <Icon name="arrowRight" size={16} className="text-fg-faint" />
      <div data-ws-item className="flex flex-col items-center gap-1 rounded-xl bg-bad-soft px-3 py-2 text-bad">
        <Icon name="swap" size={18} />
        <span className="text-[10px] font-bold">2 differences</span>
      </div>
    </div>
  );
}

function Documents() {
  const files: [string, string, number][] = [
    ["SI_4471.pdf", "SI", 100],
    ["draft_BL.docx", "BL", 100],
    ["scan_0031.pdf", "?", 64],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-3">
      {files.map(([name, type, pct]) => (
        <div key={name} data-ws-item className="rounded-lg bg-surface-solid px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px]">
            <Icon name="file" size={11} className="text-fg-faint" />
            <span className="font-medium">{name}</span>
            <span className={`ml-auto rounded px-1 py-px font-mono text-[9px] font-bold ${type === "?" ? "bg-warn-soft text-warn" : "bg-accent/15 text-accent-strong"}`}>{type}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-line">
            <div data-ws-bar className="h-full origin-left rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const VISUALS: Record<WorkspaceKey, () => React.ReactNode> = {
  results: Results,
  conflicts: Conflicts,
  review: Review,
  export: Export,
  sandbox: Sandbox,
  documents: Documents,
};

export function WorkspaceVisual({ kind }: { kind: WorkspaceKey }) {
  const Visual = VISUALS[kind];
  return (
    <div aria-hidden="true" className="relative h-[118px] overflow-hidden rounded-xl bg-sunken">
      <Visual />
    </div>
  );
}
