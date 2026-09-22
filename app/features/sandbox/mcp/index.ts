import { z } from "zod";
import { LLM_PROVIDER_IDS } from "@/lib/llm";
import { runAdhocTest } from "../logic";

const fileSchema = z.object({
  name: z.string().describe('File name including extension, e.g. "my_si.pdf"'),
  data_base64: z.string().describe("Base64-encoded file content"),
});

/**
 * MCP tool for the sandbox module (read-only — writes to no database, discarded after use).
 * Lets an AI agent / judge run an ad-hoc test with their own SI+BL document pair, without depending on the repo's built-in sample data.
 */
export const sandboxMcpTool = {
  name: "run_adhoc_test",
  description:
    "Run classification (only runs if an email subject/body is given) on your own SI + BL documents (base64-encoded, not the repo's sample data), " +
    "then extraction + comparison, and return the results. Writes to no database, no Supabase configuration required.",
  inputSchema: {
    subject: z.string().optional().describe("Email subject; classification only runs if given"),
    body: z.string().optional().describe("Email body; classification only runs if given"),
    from: z.string().optional().describe("Sender"),
    si: fileSchema,
    bl: fileSchema,
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("Omit to match the default production engine (rules first, Gemini fallback only for missing fields, Jev for comparison review)"),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) =>
    runAdhocTest(args as unknown as Parameters<typeof runAdhocTest>[0]),
};
