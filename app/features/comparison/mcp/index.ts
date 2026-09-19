import { z } from "zod";
import { compareDocuments } from "../logic";
import { LLM_PROVIDER_IDS, type LLMProvider } from "@/lib/llm";

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
  .describe("从 extraction 模块拿到的已抽取字段");

export const comparisonMcpTool = {
  name: "compare_documents",
  description:
    "比对 SI 和 BL 的抽取字段，返回 OK/MISMATCH/NEEDS_REVIEW 状态和不一致的字段列表",
  inputSchema: {
    si: fieldsSchema,
    bl: fieldsSchema,
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("用哪个模型，缺省 claude（逐字符精确比较）；选 jev 可容忍格式差异"),
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
