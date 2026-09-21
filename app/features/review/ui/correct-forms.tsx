"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { COMPARED_FIELDS, COMPARISON_STATUSES, EMAIL_CATEGORIES, REVIEW_REASONS } from "@/lib/shared/types";
import { Icon } from "../../../_components/icon";
import type { ComparedField, ComparisonStatus, EmailCategory, FieldValues, ResultRow, ReviewReason } from "../../../_lib/contracts";
import { CATEGORY_META, STATUS_META, fieldLabel, reasonLabel } from "../../../_lib/labels";
import type { ApplyReviewActionRequest, ReviewModule, ReviewQueueItem } from "./review-api";

type Payload = NonNullable<ApplyReviewActionRequest["payload"]>;

interface FormProps {
  item: ReviewQueueItem;
  row: ResultRow | null;
  busy: boolean;
  onSubmit: (payload: Payload, note: string) => void;
  onCancel: () => void;
}

function FormShell({ title, busy, canSubmit, note, onNote, onSubmit, onCancel, children }: { title: string; busy: boolean; canSubmit: boolean; note: string; onNote: (v: string) => void; onSubmit: (e: FormEvent) => void; onCancel: () => void; children: ReactNode }) {
  return (
    <form onSubmit={onSubmit} className="animate-pop space-y-4 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon name="edit" size={17} className="text-accent-strong" />
        {title}
      </div>
      {children}
      <input value={note} onChange={(e) => onNote(e.target.value)} placeholder="Why? (optional note for the history)" aria-label="Note" className="field" />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || !canSubmit} className="btn btn-primary btn-shine !py-2">
          <Icon name="save" size={16} />
          {busy ? "Saving…" : "Save correction"}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-glass !py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ComparisonCorrect({ item, busy, onSubmit, onCancel }: FormProps) {
  const start = item.override?.comparison_status ?? item.comparison_status ?? "MISMATCH";
  const [status, setStatus] = useState<ComparisonStatus>(start);
  const [fields, setFields] = useState<ComparedField[]>(item.override?.defect_fields ?? (item.defect_fields as ComparedField[]));
  const [reason, setReason] = useState<ReviewReason | "">(item.override?.review_reason ?? item.review_reason ?? "");
  const [note, setNote] = useState("");

  const valid = status === "OK" || (status === "MISMATCH" && fields.length > 0) || (status === "NEEDS_REVIEW" && reason !== "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(
      {
        comparison_status: status,
        review_reason: status === "NEEDS_REVIEW" ? (reason as ReviewReason) : null,
        defect_fields: status === "MISMATCH" ? fields : [],
      },
      note
    );
  };

  return (
    <FormShell title="Correct the comparison result" busy={busy} canSubmit={valid} note={note} onNote={setNote} onSubmit={submit} onCancel={onCancel}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome">
        {COMPARISON_STATUSES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition active:scale-95 ${status === s ? "border-accent bg-accent/15" : "border-line bg-sunken text-fg-muted hover:border-line-strong"}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].color }} />
            {STATUS_META[s].label}
          </button>
        ))}
      </div>

      {status === "MISMATCH" && (
        <fieldset className="animate-rise">
          <legend className="mb-2 text-xs font-semibold text-fg-muted">Which fields differ? (pick at least one)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {COMPARED_FIELDS.map((field) => (
              <label key={field} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-sunken px-3 py-2 text-sm transition hover:border-line-strong">
                <input type="checkbox" checked={fields.includes(field)} onChange={() => setFields((prev) => (prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]))} className="h-4 w-4 accent-[var(--accent)]" />
                {fieldLabel(field)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {status === "NEEDS_REVIEW" && (
        <label className="animate-rise block text-sm">
          <span className="mb-1.5 block text-xs font-semibold text-fg-muted">Why is it uncertain?</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as ReviewReason | "")} className="field">
            <option value="">Choose a reason…</option>
            {REVIEW_REASONS.map((r) => (
              <option key={r} value={r}>
                {reasonLabel(r)}
              </option>
            ))}
          </select>
        </label>
      )}
    </FormShell>
  );
}

function ClassificationCorrect({ item, busy, onSubmit, onCancel }: FormProps) {
  const [category, setCategory] = useState<EmailCategory>(item.override?.category ?? item.category ?? "GENERAL");
  const [note, setNote] = useState("");
  return (
    <FormShell title="Change the category" busy={busy} canSubmit note={note} onNote={setNote} onSubmit={(e) => { e.preventDefault(); onSubmit({ category }, note); }} onCancel={onCancel}>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Category">
        {EMAIL_CATEGORIES.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)} className={`flex items-start gap-3 rounded-xl border p-3 text-left transition active:scale-[0.98] ${category === c ? "border-accent bg-accent/15" : "border-line bg-sunken hover:border-line-strong"}`}>
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: CATEGORY_META[c].color }} />
            <span>
              <span className="block text-sm font-semibold">{CATEGORY_META[c].label}</span>
              <span className="block text-[11px] leading-snug text-fg-muted">{CATEGORY_META[c].desc}</span>
            </span>
          </button>
        ))}
      </div>
    </FormShell>
  );
}

function ExtractionCorrect({ item, row, busy, onSubmit, onCancel }: FormProps) {
  const original = { si: item.override?.extracted_si ?? row?.extracted_si ?? {}, bl: item.override?.extracted_bl ?? row?.extracted_bl ?? {} } as { si: FieldValues; bl: FieldValues };
  const [si, setSi] = useState<FieldValues>({ ...original.si });
  const [bl, setBl] = useState<FieldValues>({ ...original.bl });
  const [note, setNote] = useState("");

  const changed = (now: FieldValues, before: FieldValues) => COMPARED_FIELDS.filter((f) => (now[f] ?? "") !== (before[f] ?? "")).reduce<FieldValues>((acc, f) => ({ ...acc, [f]: now[f] ?? "" }), {});
  const siChanges = changed(si, original.si);
  const blChanges = changed(bl, original.bl);
  const any = Object.keys(siChanges).length + Object.keys(blChanges).length > 0;

  return (
    <FormShell title="Fix the extracted fields" busy={busy} canSubmit={any} note={note} onNote={setNote} onSubmit={(e) => { e.preventDefault(); onSubmit({ ...(Object.keys(siChanges).length ? { extracted_si: siChanges } : {}), ...(Object.keys(blChanges).length ? { extracted_bl: blChanges } : {}) }, note); }} onCancel={onCancel}>
      <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {COMPARED_FIELDS.map((field) => (
          <div key={field} className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr] sm:items-center">
            <span className="text-xs font-semibold">{fieldLabel(field)}</span>
            <input value={si[field] ?? ""} onChange={(e) => setSi({ ...si, [field]: e.target.value })} placeholder="SI value" aria-label={`SI ${fieldLabel(field)}`} className="field !text-xs" />
            <input value={bl[field] ?? ""} onChange={(e) => setBl({ ...bl, [field]: e.target.value })} placeholder="BL value" aria-label={`BL ${fieldLabel(field)}`} className="field !text-xs" />
          </div>
        ))}
      </div>
    </FormShell>
  );
}

/** Which correction form fits the module. Pipeline items have nothing to correct: they can only be re-run or set aside. */
export function CorrectForm({ module, ...props }: FormProps & { module: ReviewModule }) {
  if (module === "comparison") return <ComparisonCorrect {...props} />;
  if (module === "classification") return <ClassificationCorrect {...props} />;
  if (module === "extraction") return <ExtractionCorrect {...props} />;
  return null;
}
