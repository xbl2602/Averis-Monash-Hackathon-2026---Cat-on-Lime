/**
 * Orchestration layer (pipeline): chains "classify -> extract -> compare" into the single
 * canonical flow (see DATA_FLOW.md).
 * The web page, REST API, MCP, and evaluation scripts should all go through here whenever
 * they need to run "one email" or "a whole inbox" — don't re-assemble the sequence elsewhere.
 *
 * This is also where the 4 kinds of "uncertain" verdicts are decided (corresponding to the
 * official review_reason):
 * - missing_attachment: the email says something like "please check the SI against the draft
 *   BL", but the attachment is missing
 *   (note: "please send over the draft BL for review" is just requesting the file, there's
 *   nothing to check yet, so the baseline is OK)
 * - wrong_doc_type: the attachment isn't an SI/BL (e.g. commercial invoice/packing
 *   list/certificate of origin)
 * - unreadable: no text could be extracted from the attachment (scanned image/corrupted file)
 * - missing_value: a key field is missing (e.g. a placeholder like TBA / N/A / ____MT)
 */
import { createHash } from "node:crypto";
import { classifyEmailHybrid } from "@/app/features/classification/logic";
import { compareDocumentsHybrid } from "@/app/features/comparison/logic";
import { extractFields } from "@/app/features/extraction/logic";
import type { LLMProvider } from "@/lib/llm";
import { mapWithConcurrencyLimit } from "@/lib/shared/concurrency";
import { identifyDocumentTypeSmart } from "@/lib/shared/document-identify-llm";
import {
  COMPARED_FIELDS,
  type EmailVerificationResult,
  type ExtractedDocumentEvidence,
  type ExtractedDocumentFields,
  type InboxEmail,
  type ReviewReason,
} from "@/lib/shared/types";

// The engine version number has moved to the leaf module lib/shared/versions.ts (so the
// export function only needs the version number, without pulling in the whole pipeline just
// for that); re-exported here so every existing import path (pipeline/logic,
// verification-store, etc.) stays unchanged.
export { PIPELINE_LOGIC_VERSION } from "./versions";

export interface PipelineAttachment {
  path: string;
  parseStatus: "ok" | "unreadable";
  text: string;
}

export interface PipelineEmailInput {
  email: InboxEmail;
  attachments: PipelineAttachment[];
}

export interface PipelineOptions {
  /** The text model used for extraction/classification fallback (defaults to gemini) */
  textProvider?: LLMProvider;
}

export interface PipelineMeta {
  classifier: "rules" | "jev" | "llm" | "degraded";
  extractor: { si: "rules" | "llm" | null; bl: "rules" | "llm" | null };
  comparer: "rules" | "rules+jev" | "rules-degraded" | null;
}

export interface PipelineOutcome {
  result: EmailVerificationResult;
  meta: PipelineMeta;
  /** The extracted fields (used by the results layer to store extracted_si / extracted_bl) */
  extracted: { si: ExtractedDocumentFields | null; bl: ExtractedDocumentFields | null };
  /** Field-level evidence (P1-7): the line number/original sentence a rule matched; the LLM fallback only tags its source */
  evidence: { si: ExtractedDocumentEvidence | null; bl: ExtractedDocumentEvidence | null };
}

export async function runEmailPipeline(
  input: PipelineEmailInput,
  options: PipelineOptions = {}
): Promise<PipelineOutcome> {
  const classification = await classifyEmailHybrid({
    email: input.email,
    provider: options.textProvider,
  });
  const meta: PipelineMeta = {
    classifier: classification.engine,
    extractor: { si: null, bl: null },
    comparer: null,
  };
  const extracted: PipelineOutcome["extracted"] = { si: null, bl: null };
  const evidence: PipelineOutcome["evidence"] = { si: null, bl: null };

  if (classification.category !== "BL_COMPARISON") {
    return {
      result: buildOk(classification.category),
      meta,
      extracted,
      evidence,
    };
  }

  const { siDoc, blDoc } = await resolveDocumentPair(input.attachments, options.textProvider);

  if (!siDoc || !blDoc) {
    const result = emailAsksForComparison(input.email.body)
      ? buildReview(classification.category, "missing_attachment")
      : buildOk(classification.category);
    return { result, meta, extracted, evidence };
  }

  const si =
    siDoc.parseStatus === "ok"
      ? await extractFields({
          documentText: siDoc.text,
          documentType: "SI",
          provider: options.textProvider,
        })
      : null;
  const bl =
    blDoc.parseStatus === "ok"
      ? await extractFields({
          documentText: blDoc.text,
          documentType: "BL",
          provider: options.textProvider,
        })
      : null;
  meta.extractor = { si: si?.extracted_by ?? null, bl: bl?.extracted_by ?? null };

  if (si?.document_type === "OTHER" || bl?.document_type === "OTHER") {
    return { result: buildReview(classification.category, "wrong_doc_type"), meta, extracted, evidence };
  }
  if (siDoc.parseStatus !== "ok" || blDoc.parseStatus !== "ok" || !si || !bl) {
    return { result: buildReview(classification.category, "unreadable"), meta, extracted, evidence };
  }

  extracted.si = si.fields;
  extracted.bl = bl.fields;
  evidence.si = si.evidence;
  evidence.bl = bl.evidence;

  const missingField = COMPARED_FIELDS.some(
    (field) => !si.fields[field] || !bl.fields[field]
  );
  if (missingField) {
    return { result: buildReview(classification.category, "missing_value"), meta, extracted, evidence };
  }

  const comparison = await compareDocumentsHybrid({ si: si.fields, bl: bl.fields });
  meta.comparer = comparison.engine;
  return {
    result: {
      category: classification.category,
      status: comparison.status,
      review_reason: null,
      defect_fields: comparison.defect_fields,
      has_defect: comparison.has_defect,
    },
    meta,
    extracted,
    evidence,
  };
}

export interface BatchPipelineOptions extends PipelineOptions {
  /** Max number to process at once, defaults to 4 (see the concurrency-limit requirement in the "High Concurrency" section of CLAUDE.md) */
  concurrency?: number;
  onProgress?: (done: number, total: number, emailId: string) => void;
}

export interface BatchPipelineOutcome {
  succeeded: { input: PipelineEmailInput; outcome: PipelineOutcome }[];
  failed: { input: PipelineEmailInput; error: unknown }[];
}

/** Batch run: bounded concurrency + a single failure doesn't take down the whole batch */
export async function runBatchPipeline(
  inputs: PipelineEmailInput[],
  options: BatchPipelineOptions = {}
): Promise<BatchPipelineOutcome> {
  let done = 0; // A local variable scoped to this call, so it's inherently concurrency-safe

  const outcome = await mapWithConcurrencyLimit(
    inputs,
    async (input) => {
      const result = await runEmailPipeline(input, options);
      done += 1;
      options.onProgress?.(done, inputs.length, input.email.email_id);
      return result;
    },
    { concurrency: options.concurrency ?? 4 }
  );

  return {
    succeeded: outcome.succeeded.map((entry) => ({ input: entry.item, outcome: entry.result })),
    failed: outcome.failed.map((entry) => ({ input: entry.item, error: entry.error })),
  };
}

/**
 * Email-level input fingerprint (includes the attachment parse results): if the content and
 * the engine version are both unchanged, the whole email can be skipped on a rerun.
 */
export function computeInputHash(input: PipelineEmailInput): string {
  const payload = {
    email: {
      email_id: input.email.email_id,
      from: input.email.from,
      subject: input.email.subject,
      body: input.email.body,
      attachments: input.email.attachments,
    },
    documents: input.attachments.map((attachment) => ({
      path: attachment.path,
      parseStatus: attachment.parseStatus,
      text: attachment.text,
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// "Please compare/check the SI against the draft BL" — this commits to a comparison, but the
// attachment is missing -> missing_attachment;
// whereas "please send over the draft BL for review" is just requesting the file -> doesn't trigger it
const ASKS_COMPARISON = /(compare|check)[^.\n]{0,60}(si\b|draft\s*bl|bill\s+of\s+lading)/i;

export function emailAsksForComparison(body: string): boolean {
  return ASKS_COMPARISON.test(body);
}

function findDocument(
  attachments: PipelineAttachment[],
  marker: "_SI" | "_BL"
): PipelineAttachment | undefined {
  const pattern = marker === "_SI" ? /_SI[._]/i : /_BL[._]/i;
  return attachments.find((attachment) => pattern.test(attachment.path));
}

/**
 * Pairs up the SI / BL attachments (2026-09-21 P0-3, see DECISION_LOG decision 26):
 * 1. First pair by the _SI / _BL marker in the filename (the historical behavior; the sample
 *    data follows this path);
 * 2. If either side is still missing, run content-based identification (keyword rules take
 *    priority; only fall back to the model chain when the rules can't tell) over the
 *    attachments that aren't already claimed and that parsed to readable text — this only
 *    fills in the missing side, and the same attachment can never be claimed by both SI and BL;
 * 3. If content identification also can't tell, the side stays missing and we fall through to
 *    the original missing_attachment / unreadable branches.
 * The identification rules themselves live only in lib/shared/document-identify.ts /
 * document-identify-llm.ts — don't reimplement them here.
 */
async function resolveDocumentPair(
  attachments: PipelineAttachment[],
  preferred?: LLMProvider
): Promise<{ siDoc?: PipelineAttachment; blDoc?: PipelineAttachment }> {
  let siDoc = findDocument(attachments, "_SI");
  let blDoc = findDocument(attachments, "_BL");
  if (siDoc && blDoc) return { siDoc, blDoc };

  const claimed = new Set(
    [siDoc, blDoc].filter((doc): doc is PipelineAttachment => Boolean(doc))
  );
  const candidates = attachments.filter(
    (attachment) => !claimed.has(attachment) && attachment.parseStatus === "ok"
  );
  for (const candidate of candidates) {
    if (siDoc && blDoc) break;
    const type = await identifyDocumentTypeSmart(candidate.text, preferred);
    if (type === "SI" && !siDoc) siDoc = candidate;
    else if (type === "BL" && !blDoc) blDoc = candidate;
  }
  return { siDoc, blDoc };
}

function buildOk(category: EmailVerificationResult["category"]): EmailVerificationResult {
  return {
    category,
    status: "OK",
    review_reason: null,
    defect_fields: [],
    has_defect: false,
  };
}

function buildReview(
  category: EmailVerificationResult["category"],
  reason: ReviewReason
): EmailVerificationResult {
  return {
    category,
    status: "NEEDS_REVIEW",
    review_reason: reason,
    defect_fields: [],
    has_defect: false,
  };
}
