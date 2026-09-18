import type { InboxEmail, EmailCategory } from "@/lib/shared/types";

export interface ClassifyEmailInput {
  email: InboxEmail;
}

export interface ClassifyEmailResult {
  category: EmailCategory;
}

/**
 * TODO(classification 负责人): 这是占位实现，还没有真的分析邮件内容。
 * 换成真实逻辑时：调用 @/lib/llm 的 callLLM，把 email.subject + email.body
 * 丢给模型，让它从 BL_COMPARISON / SI_REQUEST / INVOICE_QUERY / GENERAL / SPAM
 * 里选一个（枚举定义见 @/lib/shared/types）。
 */
export async function classifyEmail(
  input: ClassifyEmailInput
): Promise<ClassifyEmailResult> {
  void input; // 占位实现还用不到参数，先保留签名
  return { category: "GENERAL" };
}
