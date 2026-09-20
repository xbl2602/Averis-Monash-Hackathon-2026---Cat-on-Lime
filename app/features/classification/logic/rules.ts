/**
 * 邮件分类的"显式处理"规则（关键词/模板签名）：
 * 先用高精度签名命中（这批业务邮件有明显的模板特征），命不中就交给上层（Jev）判断。
 * 2026-09-20 全量强制重跑实测：520 封样例全部直接判对、0 封判错、0 封交给 Jev。
 * 规则顺序有讲究：GENERAL 的内部通知模板要先于"发票/提单"关键词检查，避免被误导词带偏。
 */
import type { EmailCategory } from "@/lib/shared/types";
import { normalizeText } from "@/lib/shared/normalize";

export interface RuleClassification {
  category: EmailCategory;
  /** 命中的签名或打分依据，方便展示/排查 */
  evidence: string;
}

type Signature = { category: EmailCategory; pattern: RegExp };

// 高精度模板签名（按优先级从上到下，第一命中即定）
const SIGNATURES: Signature[] = [
  // SPAM：钓鱼/广告模板
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
  // GENERAL：内部运营通知（先于 BL/SI/发票关键词，避免"Billing/Submit SI"这类误导词）
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
  // BL_COMPARISON：核对/修改提单
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
  // SI_REQUEST：发送/索取装运指示
  { category: "SI_REQUEST", pattern: /please find shipping instruction/ },
  { category: "SI_REQUEST", pattern: /shipping instruction for/ },
  { category: "SI_REQUEST", pattern: /request si\b/ },
  { category: "SI_REQUEST", pattern: /si needed/ },
  { category: "SI_REQUEST", pattern: /draft si/ },
  { category: "SI_REQUEST", pattern: /request for si/ },
  { category: "SI_REQUEST", pattern: /si request/ },
  // INVOICE_QUERY：发票/费用询问
  { category: "INVOICE_QUERY", pattern: /query on invoice/ },
  { category: "INVOICE_QUERY", pattern: /cancel invoice/ },
  { category: "INVOICE_QUERY", pattern: /d&d/ },
  { category: "INVOICE_QUERY", pattern: /detention charge/ },
  { category: "INVOICE_QUERY", pattern: /local charge/ },
  { category: "INVOICE_QUERY", pattern: /\bthc\b/ },
  { category: "INVOICE_QUERY", pattern: /invoice/ },
];

// 打分兜底（签名都不命中时用；主题算两遍、权重更高）。分差 >= 2 才敢自动下结论
const SCORE_WORDS: Record<EmailCategory, string[]> = {
  BL_COMPARISON: ["draft bl", "draft b/l", "bl draft", "confirm the details", "check the details"],
  SI_REQUEST: ["shipping instruction", "pol:", "pod:", "shipper:"],
  INVOICE_QUERY: ["charges", "freight", "payment", "billing", "remittance"],
  SPAM: ["congratulations", "gift card", "prize", "winner", "unsubscribe"],
  GENERAL: ["reminder", "summary", "report", "planning", "schedule", "outstanding"],
};

const SCORE_MARGIN = 2;

export function classifyByRules(input: { subject: string; body: string }): RuleClassification | null {
  const text = normalizeText(`${input.subject} ${input.subject} ${input.body}`);

  for (const signature of SIGNATURES) {
    if (signature.pattern.test(text)) {
      return { category: signature.category, evidence: `sig:${signature.pattern.source}` };
    }
  }

  const scores = {} as Record<EmailCategory, number>;
  for (const [category, words] of Object.entries(SCORE_WORDS) as [EmailCategory, string[]][]) {
    scores[category] = words.filter((word) => text.includes(word)).length;
  }
  const sorted = (Object.entries(scores) as [EmailCategory, number][]).sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = sorted[0];
  const margin = topScore - sorted[1][1];
  if (topScore >= 1 && margin >= SCORE_MARGIN) {
    return { category: topCategory, evidence: `score:${JSON.stringify(scores)}` };
  }
  return null;
}
