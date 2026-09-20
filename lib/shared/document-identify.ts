/**
 * 按"文档内容"识别单证类型（不依赖文件名）。
 *
 * 为什么放在 lib/shared：import 模块（用户上传的文档）和 extraction 模块
 * 都要判断"这份文档到底是什么"，规则只能有一份，避免两边各写一套以后慢慢漂移。
 *
 * 判断顺序是有意的：先判 OTHER，再判 SI，最后 BL——
 * 1. 样例里的陷阱（如 email_501_BL.txt）其实是商业发票，里面也会出现
 *    "B/L date"、"Seller/Buyer" 这类字样；不先判 OTHER 会把发票误判成提单。
 *    这也和 extraction 现有口径（label-parser 原来就在这里判断）保持一致。
 * 2. 样例里的 SI 标题会写成 "BILL OF LADING INSTRUCTION"，含 "bill of lading"
 *    字样，所以必须先判 SI 再判 BL，否则 SI 会被误判成 BL。
 */
import type { DocumentType } from "./types";

// 其他单证特征（样例里 wrong_doc_type 陷阱的三种：商业发票/装箱单/产地证）
export function isLikelyOtherDocument(text: string): boolean {
  return /(commercial invoice|packing list|certificate of origin)/i.test(text);
}

// BL 的强特征：正文直接点名提单
const BL_STRONG = /bill of lading|\bbl draft\b|提单/;
// BL 的弱特征 + 佐证：只写 "B/L" 时，必须同时出现提单号/船名等提单专有要素
const BL_WEAK = /\bb\/l\b/;
const BL_SUPPORT =
  /(b\/l no|bill of lading no|提单号|ocean vessel|vessel|voyage|container count|place of delivery|to the order of)/;

// SI 的强特征：标题写明托运指示。
// 样例里 SI 的标题有三种写法：SHIPPING INSTRUCTION（txt）、BILL OF LADING INSTRUCTION（pdf）、
// BL INSTRUCTION（xlsx）——后两种带 "bill of lading"/"BL" 字样但仍然是"给承运人的指示"，
// 所以 SI_STRONG 要先于 BL 判断（BL 才写作 "BILL OF LADING"/"BL DRAFT"）
const SI_STRONG =
  /shipping instruction|(?:bill of lading|b\/l|bl)\s+instructions?\b|装运指示|托运指示|提单指示/;
// SI 的弱特征 + 佐证：只写 "SI" 时，要求出现至少 2 个托运指示才有的字段布局
const SI_WEAK = /\bsi\b|\bs\/i\b/;
const SI_FIELD_LABELS = [
  /shipper/,
  /consignee/,
  /notify/,
  /port of loading|\bpol\b/,
  /port of discharge|\bpod\b/,
  /container count|total containers/,
  /gross\s*(?:wt|weight)/,
];

/** 输入一段文档文本，输出 SI / BL / OTHER / UNKNOWN；纯函数、无副作用 */
export function identifyDocumentType(text: string): DocumentType {
  const normalized = text.normalize("NFKC").toLowerCase();

  if (isLikelyOtherDocument(text)) return "OTHER";
  const siLabelHits = SI_FIELD_LABELS.filter((pattern) => pattern.test(normalized)).length;
  if (SI_STRONG.test(normalized) || (SI_WEAK.test(normalized) && siLabelHits >= 2)) {
    return "SI";
  }
  if (BL_STRONG.test(normalized) || (BL_WEAK.test(normalized) && BL_SUPPORT.test(normalized))) {
    return "BL";
  }
  return "UNKNOWN";
}
