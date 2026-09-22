import { z } from "zod";
import { LLM_PROVIDER_IDS } from "@/lib/llm";
import { runAdhocTest } from "../logic";

const fileSchema = z.object({
  name: z.string().describe('文件名，含扩展名，例如 "my_si.pdf"'),
  data_base64: z.string().describe("文件内容的 base64 编码"),
});

/**
 * sandbox 模块的 MCP tool（只读——不写任何库，用完即丢）。
 * 给 AI agent / 评委临时测自己的 SI+BL 文档对用，不依赖仓库自带样例数据。
 */
export const sandboxMcpTool = {
  name: "run_adhoc_test",
  description:
    "拿一份自己的 SI + BL 文档（base64 编码，不是仓库自带样例）跑一次分类（给了邮件主题/正文才跑）" +
    "+ 抽取 + 比对，返回结果。不写库、不需要 Supabase 配置。",
  inputSchema: {
    subject: z.string().optional().describe("邮件主题，给了才会跑分类"),
    body: z.string().optional().describe("邮件正文，给了才会跑分类"),
    from: z.string().optional().describe("发件人"),
    si: fileSchema,
    bl: fileSchema,
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("不传 = 和线上默认引擎一致（规则优先，缺字段才用文本模型回退链 gemini → deepseek → … 兜底，比对用 Jev 复核）"),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) =>
    runAdhocTest(args as unknown as Parameters<typeof runAdhocTest>[0]),
};
