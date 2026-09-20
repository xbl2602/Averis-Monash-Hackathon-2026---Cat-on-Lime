/**
 * 写操作的统一口令校验（第二阶段 SPEC 第 1 节）。
 *
 * 规则：
 * - ADMIN_TOKEN 未配置 → 拒绝一切写操作（安全默认：宁可功能不可用，也不开放写入）
 * - 请求头 x-admin-token 与配置一致 → 放行
 *
 * 为什么不用真实登录：本阶段的演示场景下，读取全开放、写入用分享口令，
 * 既保证裁判能自由查看和跑 demo，又避免配置被路人乱改。
 */
import { NextResponse } from "next/server";

export function requireAdmin(request: Request): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "写操作被拒绝：服务端未配置 ADMIN_TOKEN。请在 .env.local / Vercel 里配置一个管理口令（见 .env.example），这是防止配置被随意修改的保护",
      },
      { status: 403 }
    );
  }
  const provided = request.headers.get("x-admin-token");
  if (provided !== expected) {
    return NextResponse.json(
      { error: "写操作口令不正确（请求头 x-admin-token 缺失或错误）" },
      { status: 401 }
    );
  }
  return null;
}
