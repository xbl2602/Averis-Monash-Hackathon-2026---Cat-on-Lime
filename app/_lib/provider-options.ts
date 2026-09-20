import { LLM_PROVIDERS, isProviderConfigured, isTextProvider } from "@/lib/llm";

export interface ProviderOption {
  id: string;
  label: string;
  /** Can write free text (usable as the pipeline's fallback model); Jev only makes structured decisions */
  textCapable: boolean;
  /** Key present (or local access available), i.e. selecting it would actually work */
  ready: boolean;
  /** Only works when the app runs on the same machine as the model */
  localOnly: boolean;
}

// English display names for the settings and pipeline screens (lib/llm labels are shared, so not edited there)
const DISPLAY_LABELS: Record<string, string> = {
  lmstudio: "LM Studio (local)",
  jev: "Jev (structured decisions)",
};

/** Read on the server: environment variables are only visible there. */
export function listProviderOptions(): ProviderOption[] {
  return LLM_PROVIDERS.map((p) => ({
    id: p.id,
    label: DISPLAY_LABELS[p.id] ?? p.label,
    textCapable: isTextProvider(p.id),
    ready: isProviderConfigured(p.id),
    localOnly: p.id === "lmstudio",
  }));
}
