/**
 * 扁平化（normalize）：把文字统一成"大小写忽略、空白折叠、全角转半角"的规范形式。
 *
 * 两个用途：
 * 1. 导入邮件时算一份，存进数据库的 *_normalized 字段，供预览/检索使用；
 * 2. 以后比对字段时先各自扁平化再比较，避免"1,000 vs 1000"以外的
 *    纯格式差异（大小写、多空格）被误报成不一致。
 *
 * 注意：扁平化只用于"比较/检索"，不要把扁平化后的文本喂给 LLM 抽取
 * （全小写、空白折叠会丢信息，影响抽取质量）。
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC") // 全角字母/数字/空格 → 半角
    .toLowerCase()
    .replace(/\s+/g, " ") // 连续空白（含换行、制表、不换行空格）折叠成一个空格
    .trim();
}
