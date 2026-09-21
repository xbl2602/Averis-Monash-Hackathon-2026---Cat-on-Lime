import type { ConfigItem } from "../../../_lib/contracts";

export type ConfigKind = "text" | "number" | "boolean" | "list" | "secret" | "url";

/** Friendly names for the known configuration keys (see PHASE2_SPEC 3.2). Unknown keys still show, with their raw name. */
export const CONFIG_META: Record<string, { label: string; hint: string; kind: ConfigKind }> = {
  "llm.provider_priority": { label: "Engine order", hint: "The engines tried for classification and comparison, in order, separated by commas.", kind: "list" },
  "llm.jev.confidence_threshold": { label: "Jev confidence threshold", hint: "Below this confidence (0 to 1) an email is sent to a person.", kind: "number" },
  "llm.default_provider": { label: "Default fallback model", hint: "The text model used when the rules cannot settle a field.", kind: "text" },
  "llm.anthropic_api_key": { label: "Claude API key", hint: "From console.anthropic.com.", kind: "secret" },
  "llm.openai_api_key": { label: "OpenAI API key", hint: "From platform.openai.com.", kind: "secret" },
  "llm.deepseek_api_key": { label: "DeepSeek API key", hint: "From platform.deepseek.com.", kind: "secret" },
  "llm.gemini_api_key": { label: "Gemini API key", hint: "From Google AI Studio.", kind: "secret" },
  "llm.typesafe_api_key": { label: "TypeSafe (Jev) API key", hint: "From console.typesafe.ai.", kind: "secret" },
  "llm.lmstudio_base_url": { label: "LM Studio address", hint: "Only works when the app runs on the same machine as LM Studio.", kind: "url" },
  "pipeline.concurrency": { label: "Emails at the same time", hint: "How many emails a batch handles in parallel (1 to 8).", kind: "number" },
  "pipeline.batch_limit": { label: "Emails per batch", hint: "The most emails one run will take.", kind: "number" },
  "storage.upload_max_file_mb": { label: "Largest single upload (MB)", hint: "Per file.", kind: "number" },
  "storage.upload_max_batch_mb": { label: "Largest upload request (MB)", hint: "Per request; uploads are split to fit.", kind: "number" },
  "mail.auto_sync_enabled": { label: "Sync mail automatically", hint: "Reserved for the Gmail integration.", kind: "boolean" },
  "mail.sync_interval_minutes": { label: "Sync every (minutes)", hint: "Reserved for the Gmail integration.", kind: "number" },
};

export const CATEGORY_LABELS: Record<ConfigItem["category"], string> = {
  llm: "Models",
  pipeline: "Pipeline",
  storage: "Uploads",
  mail: "Mail",
  general: "General",
};

export const TEST_TARGETS: { target: string; label: string }[] = [
  { target: "gemini", label: "Gemini" },
  { target: "claude", label: "Claude" },
  { target: "openai", label: "OpenAI" },
  { target: "deepseek", label: "DeepSeek" },
  { target: "typesafe", label: "Jev (TypeSafe)" },
  { target: "lmstudio", label: "LM Studio" },
  { target: "supabase", label: "Supabase" },
];

export function kindOf(item: ConfigItem): ConfigKind {
  if (CONFIG_META[item.key]) return CONFIG_META[item.key].kind;
  if (item.is_secret) return "secret";
  if (typeof item.value === "number") return "number";
  if (typeof item.value === "boolean") return "boolean";
  if (Array.isArray(item.value)) return "list";
  return "text";
}

/** What an editor shows for the current value. */
export function toDraft(item: ConfigItem): string {
  if (item.is_secret) return "";
  if (Array.isArray(item.value)) return item.value.join(", ");
  if (item.value === null || item.value === undefined) return "";
  return String(item.value);
}

/** Convert what was typed back into the JSON value the API stores. Returns undefined when the text is not valid for the kind. */
export function fromDraft(kind: ConfigKind, draft: string): string | number | boolean | string[] | undefined {
  const text = draft.trim();
  if (kind === "number") {
    const n = Number(text);
    return text !== "" && Number.isFinite(n) ? n : undefined;
  }
  if (kind === "boolean") return text === "true";
  if (kind === "list") return text.split(",").map((v) => v.trim()).filter(Boolean);
  return text === "" ? undefined : text;
}
