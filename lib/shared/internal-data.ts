/**
 * "这条数据是内部测试数据吗" 的唯一判定（叶子模块：只放常量和纯函数）。
 *
 * 背景：扰动测试集（scripts/perturb-generate.mjs）生成的邮件 id 固定是 "pt<N>_<原id>"，
 * 而它被灌进了和公开 demo 共用的那个 Supabase 项目里（决策34"共用项目避免休眠"的副作用）。
 * 于是同一套数据里混着两类东西：官方样例那 520 封，和内部回归测试的几千封。
 *
 * 2026-09-22 实测到的后果：Overview 头部按官方 520 统计，但点进去的列表页把测试数据也算上，
 * 结果每个 KPI 点一下数字就对不上（Matches 454→列表 2806、Mismatches 46→冲突页 482、
 * Need review 20→复核队列 110）。所以读取路径要有统一口径，判定规则只能有这一份。
 *
 * 口径：默认只看官方样例；需要排查内部测试数据时显式要（include_internal / 直接搜它的 id）。
 */

/** 扰动测试邮件 id 的前缀规则，见 scripts/perturb-generate.mjs 头部的"隔离约定" */
export const INTERNAL_TEST_ID_PATTERN = /^pt\d+_/;

export function isInternalTestEmailId(emailId: string): boolean {
  return INTERNAL_TEST_ID_PATTERN.test(emailId);
}

/**
 * 搜索词本身就在找内部测试数据时（比如直接搜 "pt5_email_065" 排查那一封），
 * 不要把它过滤掉——否则"按 id 精确搜"这条排查路径会变成永远搜不到。
 */
export function searchTargetsInternalData(term: string | undefined): boolean {
  return term !== undefined && /^\s*pt\d+/i.test(term);
}

/** PostgREST 侧的排除条件用的 LIKE 模式（官方样例 id 都是 email_NNN，不会误伤） */
export const INTERNAL_TEST_LIKE_PATTERN = "pt%";
