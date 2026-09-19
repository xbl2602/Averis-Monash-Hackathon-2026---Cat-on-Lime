import { z } from "zod";
import { classifyEmail } from "../logic";
import { getSampleEmail } from "@/lib/shared/inbox";
import { LLM_PROVIDER_IDS, type LLMProvider } from "@/lib/llm";

/**
 * 这个模块要暴露成 MCP tool 的定义，被 /app/core/mcp-server 汇总注册。
 * 只是"定义"，不在这里启动 server（见 CLAUDE.md "产品形态要求"）。
 */
export const classificationMcpTool = {
  name: "classify_email",
  description:
    "判断一封航运相关邮件属于 BL_COMPARISON / SI_REQUEST / INVOICE_QUERY / GENERAL / SPAM 中的哪一类",
  inputSchema: {
    email_id: z.string().describe("样例数据里的邮件ID，例如 email_004"),
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("用哪个模型，缺省 claude；选 jev 时会额外返回置信度"),
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
