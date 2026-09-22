import {
  callJev,
  callLLM,
  isJevAvailable,
  type JevQuestion,
  type LLMProvider,
} from "@/lib/llm";
import { callTextLLMChain } from "@/lib/shared/llm-chain";
import { callWithCache } from "@/lib/shared/llm-cache";
import { EMAIL_CATEGORIES, type InboxEmail, type EmailCategory } from "@/lib/shared/types";
import { classifyByRules, classifyByRulesBestEffort } from "./rules";

export interface ClassifyEmailInput {
  email: InboxEmail;
  /**
   * Explicitly pick which model to use; **when omitted, goes through the hybrid engine**
   * (rules first → Jev → text-model fallback via Gemini), so a result can still be produced
   * even with no keys configured locally (the demo fallback; see CLAUDE.md).
   */
  provider?: LLMProvider;
}

export interface ClassifyEmailResult {
  category: EmailCategory;
  /** Confidence in the 0-1 range; only Jev (a structured model) can provide this — text LLM / rules paths return null */
  confidence: number | null;
  /** True when confidence is below the threshold, flagging that this email needs human confirmation (maps to requirement ④ in the brief) */
  needs_review: boolean;
}

export interface HybridClassificationResult extends ClassifyEmailResult {
  /** Who produced this result: rules / Jev / text-LLM chain / the last-resort fallback once everything else failed (degraded) */
  engine: "rules" | "jev" | "llm" | "degraded";
}

// The single source of truth for the category list is EMAIL_CATEGORIES in lib/shared/types.ts; this is just a local alias
const CATEGORIES: readonly EmailCategory[] = EMAIL_CATEGORIES;

// What each category means — used both as Jev's choice criteria and as the text LLM's prompt description
const CATEGORY_DEFINITIONS: Record<EmailCategory, string> = {
  BL_COMPARISON: "Sends a draft Bill of Lading (BL) and asks to verify/confirm it matches the Shipping Instruction (SI)",
  SI_REQUEST: "Sends or requests a Shipping Instruction (SI)",
  INVOICE_QUERY: "Asks about an invoice, charges, or payment",
  GENERAL: "Other normal shipping-business correspondence that doesn't fit the categories above and isn't spam",
  SPAM: "Advertising, phishing, or junk mail unrelated to shipping business",
};

// Below this confidence, flag for human review (0.85 is the operator's deliberately conservative choice: better to over-flag for review than to let something slip through)
const JEV_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Single entry point: call explicitly by provider (used by REST/MCP/the UI).
 * When provider is omitted, goes through the hybrid engine (rules first, so a result comes back
 * even with no key configured locally), but only ever exposes the three fields
 * `category/confidence/needs_review` — the response contract is identical whether or not a
 * provider was given explicitly.
 */
export async function classifyEmail(
  input: ClassifyEmailInput
): Promise<ClassifyEmailResult> {
  if (input.provider === undefined) {
    const hybrid = await classifyEmailHybrid(input);
    return {
      category: hybrid.category,
      confidence: hybrid.confidence,
      needs_review: hybrid.needs_review,
    };
  }
  if (input.provider === "jev") {
    return classifyWithJev(input.email);
  }
  return classifyWithTextLLM(input.provider, input.email);
}

/**
 * Hybrid classification (the pipeline default): high-precision rules → anything uncertain goes
 * to Jev → if Jev is unavailable/fails, fall back to the text-model chain → if everything fails,
 * degrade to "best-effort rules" (engine=degraded, needs_review=true; never throws for the
 * whole email).
 * 2026-09-20 full forced re-run: all 520 sample emails were decided directly by rules
 * (rules=520) — the models only serve as a fallback for new emails the rules can't handle.
 * 2026-09-21 (P0-2): each stage has its own try/catch, so a failure at one stage doesn't affect
 * the next; failure reasons only go to the server log.
 */
export async function classifyEmailHybrid(
  input: ClassifyEmailInput
): Promise<HybridClassificationResult> {
  const ruled = classifyByRules({ subject: input.email.subject, body: input.email.body });
  if (ruled) {
    return { category: ruled.category, confidence: null, needs_review: false, engine: "rules" };
  }

  if (isJevAvailable()) {
    try {
      const jev = await classifyWithJev(input.email);
      return { ...jev, engine: "jev" };
    } catch (err) {
      console.warn(
        `[classification] Jev failed, falling back to the text-model chain: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  try {
    const llm = await classifyWithTextChain(input.email, input.provider);
    return { ...llm, engine: "llm" };
  } catch (err) {
    console.warn(
      `[classification] All models failed, falling back to best-effort rules: ${err instanceof Error ? err.message : err}`
    );
  }

  // Degraded fallback: retry the rules with a relaxed threshold; if there's still no signal, default to GENERAL for now (internally flagged degraded, retryable with one click)
  const bestEffort = classifyByRulesBestEffort({
    subject: input.email.subject,
    body: input.email.body,
  });
  return {
    category: bestEffort?.category ?? "GENERAL",
    confidence: null,
    needs_review: true,
    engine: "degraded",
  };
}

/**
 * The model-input flattening contract (see docs/DECISION_SPEC.md §2.3/§2.4/§6):
 * only these 3 flat string fields are sent to Jev / the text LLM;
 * the full email object, attachment list, and metadata never appear in the model input.
 */
type FlatEmailInput = {
  from: string;
  subject: string;
  body: string;
};

function buildFlatEmailInput(email: InboxEmail): FlatEmailInput {
  return { from: email.from, subject: email.subject, body: email.body };
}

async function classifyWithJev(email: InboxEmail): Promise<ClassifyEmailResult> {
  const questions: Record<string, JevQuestion> = {
    category: {
      type: "choice",
      instructions: "Which category does this email belong to?",
      criteria: CATEGORY_DEFINITIONS,
    },
  };
  const state = buildFlatEmailInput(email);

  const { value } = await callWithCache({
    purpose: "classification",
    provider: "jev",
    model: process.env.JEV_MODEL || "jev-latest",
    request: { state, questions },
    execute: () => callJev(state, questions),
  });

  const answer = value.answers.category;
  if (!answer || answer.type !== "choice") {
    throw new Error("Jev's classification result has an unexpected shape: missing the category choice answer");
  }

  return {
    category: asCategory(answer.choice),
    confidence: answer.confidence,
    needs_review: answer.confidence < JEV_CONFIDENCE_THRESHOLD,
  };
}

async function classifyWithTextLLM(
  provider: LLMProvider,
  email: InboxEmail
): Promise<ClassifyEmailResult> {
  const prompt = buildClassificationPrompt(email);

  const { value: text } = await callWithCache({
    purpose: "classification_llm",
    provider,
    model: provider,
    request: { prompt },
    execute: () => callLLM(provider, prompt),
  });

  return toTextLlmClassification(text);
}

/**
 * The hybrid engine's text fallback: the explicitly chosen provider is tried first, then the
 * rest in a fixed order (only ones with a configured key are tried). The single-provider API
 * (where a provider is chosen explicitly) does not go through this chain — whichever provider
 * is picked is the only one tried, so it never silently swaps in a different model and reports
 * success.
 */
async function classifyWithTextChain(
  email: InboxEmail,
  preferred?: LLMProvider
): Promise<ClassifyEmailResult> {
  const prompt = buildClassificationPrompt(email);
  const { text } = await callTextLLMChain({
    purpose: "classification_llm",
    prompt,
    preferred,
  });
  return toTextLlmClassification(text);
}

function buildClassificationPrompt(email: InboxEmail): string {
  const definitions = CATEGORIES.map(
    (c) => `- ${c}: ${CATEGORY_DEFINITIONS[c]}`
  ).join("\n");
  const flat = buildFlatEmailInput(email);

  return `Decide which category the shipping email below belongs to. Answer with only the category code itself — no explanation, no punctuation, no other text.

Categories:
${definitions}

Email:
From: ${flat.from}
Subject: ${flat.subject}
Body:
${flat.body}`;
}

function toTextLlmClassification(text: string): ClassifyEmailResult {
  const category = CATEGORIES.find((c) => text.toUpperCase().includes(c));
  if (!category) {
    throw new Error(
      `Classification failed: the model did not return a valid category code (allowed values: ${CATEGORIES.join(" / ")}); actual response: ${text.slice(0, 200)}`
    );
  }
  return { category, confidence: null, needs_review: false };
}

// Defend against Jev returning a string outside its criteria (shouldn't happen in theory, since it's only allowed to pick from the given options)
function asCategory(value: string): EmailCategory {
  const found = CATEGORIES.find((c) => c === value);
  if (!found) {
    throw new Error(`Classification failed: Jev returned an unknown category "${value}"`);
  }
  return found;
}
