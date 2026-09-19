"use client";

import { useState, type FormEvent } from "react";

/**
 * 演示用联系表单：只做前端交互反馈，不发送到任何后端/第三方服务。
 * 真正要接的话，未来应该走一个新的 feature 模块（logic/api），不是现在这几天的范围。
 */
export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex h-full flex-col justify-center rounded-2xl border border-hairline bg-veil/60 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-mint/20 text-mint">
          ✓
        </div>
        <p className="font-semibold text-ink">留言已收到（演示）</p>
        <p className="mt-1 text-sm text-ink/60">这是前端演示效果，尚未接入真实的消息通道。</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink/80">姓名</span>
          <input
            required
            type="text"
            placeholder="你的名字"
            className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-ink/80">邮箱</span>
          <input
            required
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-ink/80">想聊聊什么</span>
        <textarea
          required
          rows={4}
          placeholder="产品建议、合作想法，或者只是想打个招呼"
          className="w-full resize-none rounded-xl border border-hairline bg-white px-4 py-2.5 text-sm text-ink outline-none transition focus:border-indigo focus:ring-2 focus:ring-indigo/20"
        />
      </label>
      <button
        type="submit"
        className="group relative w-full overflow-hidden rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-indigo/25 sm:w-auto"
      >
        <span className="relative z-10">发送留言</span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-indigo to-royal transition-transform duration-300 group-hover:translate-x-0" />
      </button>
    </form>
  );
}
