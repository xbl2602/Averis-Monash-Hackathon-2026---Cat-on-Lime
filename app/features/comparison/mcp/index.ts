import { z } from "zod";
import { compareDocuments } from "../logic";

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
  },
  handler: async ({ si, bl }: { si: Record<string, string>; bl: Record<string, string> }) => {
    return compareDocuments({ si, bl });
  },
};
