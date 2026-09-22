import { z } from "zod";
import { compareDocuments } from "../logic";
import { LLM_PROVIDER_IDS, type LLMProvider } from "@/lib/llm";
import { makeReviewMcpTools } from "@/lib/shared/review/mcp";

const fieldsSchema = z
  .object({
    shipper: z.string().optional(),
    consignee: z.string().optional(),
    notify_party: z.string().optional(),
    port_of_loading: z.string().optional(),
    port_of_discharge: z.string().optional(),
    container_count: z.string().optional(),
    gross_weight_kg: z.string().optional(),
  })
  .describe("Extracted fields obtained from the extraction module");

export const comparisonMcpTool = {
  name: "compare_documents",
  description:
    "Compares the extracted fields of SI and BL, returning an OK/MISMATCH/NEEDS_REVIEW status and the list of mismatched fields",
  inputSchema: {
    si: fieldsSchema,
    bl: fieldsSchema,
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("Which model to use; omit for exact character-by-character comparison (no model call), choose jev to tolerate formatting differences"),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async ({
    si,
    bl,
    provider,
  }: {
    si: Record<string, string>;
    bl: Record<string, string>;
    provider?: LLMProvider;
  }) => {
    return compareDocuments({ si, bl, provider });
  },
};

// Manual review loop (P1-1): list/get_history are read-only, apply/undo write to the database (see lib/shared/review/mcp.ts)
export const comparisonReviewMcpTools = makeReviewMcpTools("comparison", "comparison");
