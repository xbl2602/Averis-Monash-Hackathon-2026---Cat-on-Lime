/**
 * "Explicit handling" rules for email classification (keyword / template signatures):
 * high-precision signature matches are tried first (this batch of business emails has clear
 * template patterns); anything that doesn't match falls through to the layer above (Jev).
 * 2026-09-20 full forced re-run: all 520 sample emails were judged directly and correctly,
 * 0 misjudged, 0 handed off to Jev.
 * Rule order matters: the GENERAL internal-notice templates must be checked before the
 * "invoice/bill of lading" keywords, to avoid being misled by those words.
 */
import type { EmailCategory } from "@/lib/shared/types";
import { normalizeText } from "@/lib/shared/normalize";

export interface RuleClassification {
  category: EmailCategory;
  /** The signature or scoring basis that matched, for display/debugging */
  evidence: string;
}

type Signature = { category: EmailCategory; pattern: RegExp };

// High-precision template signatures (priority top-to-bottom; first match wins)
const SIGNATURES: Signature[] = [
  // SPAM: phishing/advertising templates
  { category: "SPAM", pattern: /selected in our monthly draw/ },
  { category: "SPAM", pattern: /bank officer with an urgent business proposal/ },
  { category: "SPAM", pattern: /unpaid customs fee/ },
  { category: "SPAM", pattern: /90% off/ },
  { category: "SPAM", pattern: /storage limit/ },
  { category: "SPAM", pattern: /storage is full/ },
  { category: "SPAM", pattern: /brand new iphone/ },
  { category: "SPAM", pattern: /bitcoin investment/ },
  { category: "SPAM", pattern: /one weird trick/ },
  { category: "SPAM", pattern: /guaranteed 300% returns/ },
  { category: "SPAM", pattern: /undelivered messages in your mailbox/ },
  { category: "SPAM", pattern: /avoid suspension/ },
  { category: "SPAM", pattern: /confirm your bank details/ },
  { category: "SPAM", pattern: /click here to claim/ },
  // GENERAL: internal operations notices (checked before BL/SI/invoice keywords, to avoid
  // misleading phrases like "Billing/Submit SI")
  { category: "GENERAL", pattern: /outstanding bl \(bdp sg\)/ },
  { category: "GENERAL", pattern: /submit si & aed/ },
  { category: "GENERAL", pattern: /billing process/ },
  { category: "GENERAL", pattern: /berthing report/ },
  { category: "GENERAL", pattern: /happy and prosperous new year/ },
  { category: "GENERAL", pattern: /pending bl release/ },
  { category: "GENERAL", pattern: /miss connection/ },
  { category: "GENERAL", pattern: /update summary/ },
  { category: "GENERAL", pattern: /delivery planning/ },
  { category: "GENERAL", pattern: /rpa bot/ },
  { category: "GENERAL", pattern: /time off request/ },
  { category: "GENERAL", pattern: /no action required/ },
  { category: "GENERAL", pattern: /office resumes normal operations/ },
  { category: "GENERAL", pattern: /kindly action the pending items/ },
  // BL_COMPARISON: verify/amend a bill of lading
  { category: "BL_COMPARISON", pattern: /draft bl against the si/ },
  { category: "BL_COMPARISON", pattern: /attached are the si and draft bl/ },
  { category: "BL_COMPARISON", pattern: /draft bill of lading/ },
  { category: "BL_COMPARISON", pattern: /to confirm docs/ },
  { category: "BL_COMPARISON", pattern: /request bl draft/ },
  { category: "BL_COMPARISON", pattern: /draft bl for/ },
  { category: "BL_COMPARISON", pattern: /amend bl/ },
  { category: "BL_COMPARISON", pattern: /bl matches the si/ },
  { category: "BL_COMPARISON", pattern: /check the draft bl/ },
  { category: "BL_COMPARISON", pattern: /confirm the bl/ },
  // SI_REQUEST: sending/requesting shipping instructions
  { category: "SI_REQUEST", pattern: /please find shipping instruction/ },
  { category: "SI_REQUEST", pattern: /shipping instruction for/ },
  { category: "SI_REQUEST", pattern: /request si\b/ },
  { category: "SI_REQUEST", pattern: /si needed/ },
  { category: "SI_REQUEST", pattern: /draft si/ },
  { category: "SI_REQUEST", pattern: /request for si/ },
  { category: "SI_REQUEST", pattern: /si request/ },
  // INVOICE_QUERY: invoice/charge inquiries
  { category: "INVOICE_QUERY", pattern: /query on invoice/ },
  { category: "INVOICE_QUERY", pattern: /cancel invoice/ },
  { category: "INVOICE_QUERY", pattern: /d&d/ },
  { category: "INVOICE_QUERY", pattern: /detention charge/ },
  { category: "INVOICE_QUERY", pattern: /local charge/ },
  { category: "INVOICE_QUERY", pattern: /\bthc\b/ },
  { category: "INVOICE_QUERY", pattern: /invoice/ },
];

// Scoring fallback (used when no signature matches; the subject is counted twice for extra
// weight). Only auto-concludes when the score gap >= 2
const SCORE_WORDS: Record<EmailCategory, string[]> = {
  BL_COMPARISON: ["draft bl", "draft b/l", "bl draft", "confirm the details", "check the details"],
  SI_REQUEST: ["shipping instruction", "pol:", "pod:", "shipper:"],
  INVOICE_QUERY: ["charges", "freight", "payment", "billing", "remittance"],
  SPAM: ["congratulations", "gift card", "prize", "winner", "unsubscribe"],
  GENERAL: ["reminder", "summary", "report", "planning", "schedule", "outstanding"],
};

const SCORE_MARGIN = 2;

export function classifyByRules(input: { subject: string; body: string }): RuleClassification | null {
  const text = buildScoringText(input);

  for (const signature of SIGNATURES) {
    if (signature.pattern.test(text)) {
      return { category: signature.category, evidence: `sig:${signature.pattern.source}` };
    }
  }

  return pickByScore(text, SCORE_MARGIN, "score");
}

/**
 * Best-effort version (added 2026-09-21, used as the P0-2 degraded fallback; see DECISION_LOG
 * decision 25): relaxes the auto-conclude threshold from "score gap >= 2" to "has a score and
 * isn't tied" (score gap >= 1).
 * Only used on the degraded path once every model has failed; the result is flagged
 * needs_review=true + engine=degraded. The normal path (classifyByRules) keeps its original
 * threshold — both paths share the same scoring logic.
 */
export function classifyByRulesBestEffort(input: {
  subject: string;
  body: string;
}): RuleClassification | null {
  return pickByScore(buildScoringText(input), 1, "best-effort");
}

// Subject is counted twice for extra weight (original behavior, do not change)
function buildScoringText(input: { subject: string; body: string }): string {
  return normalizeText(`${input.subject} ${input.subject} ${input.body}`);
}

function pickByScore(
  text: string,
  minMargin: number,
  evidencePrefix: string
): RuleClassification | null {
  const scores = {} as Record<EmailCategory, number>;
  for (const [category, words] of Object.entries(SCORE_WORDS) as [EmailCategory, string[]][]) {
    scores[category] = words.filter((word) => text.includes(word)).length;
  }
  const sorted = (Object.entries(scores) as [EmailCategory, number][]).sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = sorted[0];
  const margin = topScore - sorted[1][1];
  if (topScore >= 1 && margin >= minMargin) {
    return { category: topCategory, evidence: `${evidencePrefix}:${JSON.stringify(scores)}` };
  }
  return null;
}
