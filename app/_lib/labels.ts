import type { ComparedField, ComparisonStatus, EmailCategory, ReviewReason } from "./contracts";

/** Plain-English names and colours for the values the API returns. One place, so every screen agrees. */

export const CATEGORY_META: Record<EmailCategory, { label: string; desc: string; color: string; icon: "compare" | "file" | "table" | "mail" | "alert" }> = {
  BL_COMPARISON: { label: "BL comparison", desc: "A draft BL was sent to be checked against the SI", color: "var(--color-indigo)", icon: "compare" },
  SI_REQUEST: { label: "SI request", desc: "A Shipping Instruction was sent or requested", color: "var(--color-mint)", icon: "file" },
  INVOICE_QUERY: { label: "Invoice query", desc: "A question about an invoice, charges or payment", color: "var(--color-amber)", icon: "table" },
  GENERAL: { label: "General", desc: "Other normal shipping business", color: "var(--color-halo)", icon: "mail" },
  SPAM: { label: "Spam", desc: "Advertising, phishing or unrelated to shipping", color: "var(--bad)", icon: "alert" },
};

export function categoryLabel(key: string): string {
  if (key === "NOT_PROCESSED") return "Not processed";
  return CATEGORY_META[key as EmailCategory]?.label ?? key;
}

export function categoryColor(key: string): string {
  return CATEGORY_META[key as EmailCategory]?.color ?? "var(--fg-faint)";
}

export type Tone = "ok" | "bad" | "warn" | "muted" | "info";

export const STATUS_META: Record<ComparisonStatus, { label: string; tone: Tone; color: string; desc: string }> = {
  OK: { label: "Matches", tone: "ok", color: "var(--ok)", desc: "Every compared field agrees" },
  MISMATCH: { label: "Mismatch", tone: "bad", color: "var(--bad)", desc: "At least one field differs between SI and BL" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warn", color: "var(--warn)", desc: "The system could not decide; a person should look" },
};

export function statusLabel(key: string): string {
  if (key === "NOT_PROCESSED") return "Not processed";
  return STATUS_META[key as ComparisonStatus]?.label ?? key;
}

export function statusColor(key: string): string {
  return STATUS_META[key as ComparisonStatus]?.color ?? "var(--fg-faint)";
}

export const REASON_LABELS: Record<ReviewReason, string> = {
  wrong_doc_type: "Attachment is not an SI or BL",
  missing_attachment: "An SI or BL attachment is missing",
  unreadable: "A document could not be read",
  missing_value: "A required field has no value",
};

export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "";
  return REASON_LABELS[reason as ReviewReason] ?? reason.replace(/_/g, " ");
}

export const FIELD_LABELS: Record<ComparedField, string> = {
  shipper: "Shipper",
  consignee: "Consignee",
  notify_party: "Notify party",
  port_of_loading: "Port of loading",
  port_of_discharge: "Port of discharge",
  container_count: "Container count",
  gross_weight_kg: "Gross weight (kg)",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field as ComparedField] ?? field.replace(/_/g, " ");
}

const ENGINE_NAMES: Record<string, string> = { rules: "Rules", jev: "Jev", gemini: "Gemini", claude: "Claude", openai: "OpenAI", deepseek: "DeepSeek", lmstudio: "LM Studio", degraded: "Fallback" };

/**
 * The engines that actually took part in a result. The saved tag has one slot per pipeline stage
 * (classify / read SI / read BL / compare), like "rules/rules/rules/rules+jev", with "-" for a stage that did not run.
 * This boils that down to "Rules + Jev". The raw tag stays available as the tooltip.
 */
export function engineTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen: string[] = [];
  for (const part of raw.split(/[/+]/)) {
    const token = part.trim().toLowerCase();
    // "rules-degraded" style tags count as a fallback answer
    const name = token.includes("degraded") ? "degraded" : token;
    if (name && name !== "-" && !seen.includes(name)) seen.push(name);
  }
  return seen;
}

export function engineSummary(raw: string | null | undefined): string {
  const tokens = engineTokens(raw);
  return tokens.length === 0 ? "—" : tokens.map((t) => ENGINE_NAMES[t] ?? t).join(" + ");
}

/** model_provider is a free-form tag such as "rules", "jev", "rules/rules/rules/rules+jev" or "degraded". */
export function providerTone(provider: string | null): Tone {
  if (!provider) return "muted";
  return provider.includes("degraded") ? "warn" : "info";
}

export const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  bad: "bg-bad-soft text-bad",
  warn: "bg-warn-soft text-warn",
  info: "bg-accent/12 text-accent-strong",
  muted: "bg-sunken text-fg-muted",
};
