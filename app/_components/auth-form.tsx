"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * 演示用登录/注册表单：不接后端认证（Supabase Auth 还没配），
 * 提交后只是模拟一下加载态，然后带用户去控制台。真正接入身份验证是后面的事。
 */
export function AuthForm({
  mode,
}: {
  mode: "login" | "signup";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      router.push("/dashboard");
    }, 550);
  }

  const isLogin = mode === "login";

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink">{isLogin ? "欢迎回来" : "创建账户"}</h2>
      <p className="mt-1.5 text-sm text-ink/55">
        演示界面 · 尚未接入身份验证，{isLogin ? "登录" : "注册"}后会直接进入控制台
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {!isLogin && (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-ink/80">姓名</span>
            <input
              required
              type="text"
              placeholder="你的名字"
              className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
            />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink/80">邮箱</span>
          <input
            required
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink/80">密码</span>
          <input
            required
            type="password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="group relative w-full overflow-hidden rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-indigo/25 disabled:opacity-70"
        >
          <span className="relative z-10">{loading ? "处理中…" : isLogin ? "登录" : "注册"}</span>
          {!loading && (
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-indigo to-royal transition-transform duration-300 group-hover:translate-x-0" />
          )}
        </button>
      </form>

      <div className="mt-5 text-center text-sm text-ink/55">
        {isLogin ? (
          <>
            还没有账号？{" "}
            <Link href="/signup" className="font-semibold text-indigo hover:underline">
              去注册
            </Link>
          </>
        ) : (
          <>
            已经有账号？{" "}
            <Link href="/login" className="font-semibold text-indigo hover:underline">
              去登录
            </Link>
          </>
        )}
      </div>

      <Link
        href="/dashboard"
        className="mt-6 block rounded-xl border border-dashed border-hairline px-4 py-3 text-center text-sm font-medium text-ink/60 transition hover:border-indigo/40 hover:text-indigo"
      >
        跳过登录，直接体验 Demo →
      </Link>
    </div>
  );
}
