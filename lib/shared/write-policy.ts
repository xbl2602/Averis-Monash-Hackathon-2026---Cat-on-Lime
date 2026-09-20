/**
 * 写操作口令策略的唯一实现（REST 路由与 MCP 汇总层共用，与传输方式无关）。
 *
 * 规则（与第二阶段 SPEC 第 1 节一致）：
 * - ADMIN_TOKEN 未配置 → 拒绝一切写操作（安全默认：宁可功能不可用，也不开放写入），HTTP 403
 * - 请求头 x-admin-token 与配置一致 → 放行
 * - 其它情况（缺失/错误）→ HTTP 401
 *
 * 为什么不用真实登录：演示场景下读取全开放、写入用分享口令，
 * 既保证裁判能自由查看和跑 demo，又避免数据被路人乱改。
 */

export type WriteAccess =
  | { authorized: true }
  | { authorized: false; status: 401 | 403; message: string };

export function getWriteAccess(headers: Headers): WriteAccess {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return {
      authorized: false,
      status: 403,
      message:
        "写操作被拒绝：服务端未配置 ADMIN_TOKEN。请在 .env.local / Vercel 里配置一个管理口令（见 .env.example），这是防止配置被随意修改的保护",
    };
  }
  const provided = headers.get("x-admin-token");
  if (provided !== expected) {
    return {
      authorized: false,
      status: 401,
      message: "写操作口令不正确（请求头 x-admin-token 缺失或错误）",
    };
  }
  return { authorized: true };
}
