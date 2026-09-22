import { z } from "zod";
import { classifyEmail } from "../logic";
import { getSampleEmail } from "@/lib/shared/inbox";
import { LLM_PROVIDER_IDS, type LLMProvider } from "@/lib/llm";
import { makeReviewMcpTools } from "@/lib/shared/review/mcp";

/**
 * This module's MCP tool definitions, aggregated and registered by /app/core/mcp-server.
 * This file only provides the "definitions" — the server is not started here (see CLAUDE.md
 * "product form requirements").
 * Hard rule for annotations: a read-only tool must explicitly declare readOnlyHint: true
 * (see app/core/mcp-server/tools.ts).
 */
export const classificationMcpTool = {
  name: "classify_email",
  description:
    "Determines which category a shipping-related email belongs to: BL_COMPARISON / SI_REQUEST / INVOICE_QUERY / GENERAL / SPAM",
  inputSchema: {
    email_id: z.string().describe("The email ID in the sample data, e.g. email_004"),
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe(
        "Which model to use; omit for the hybrid engine (rules → Jev → Gemini text fallback), choosing jev also returns a confidence score"
      ),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async ({
    email_id,
    provider,
  }: {
    email_id: string;
    provider?: LLMProvider;
  }) => {
    const email = await getSampleEmail(email_id);
    return classifyEmail({ email, provider });
  },
};

// Manual review loop (P1-1): the queue currently only covers "all-model failure fallback," see docs/TODO.md for implementation notes
export const classificationReviewMcpTools = makeReviewMcpTools("classification", "classification");
