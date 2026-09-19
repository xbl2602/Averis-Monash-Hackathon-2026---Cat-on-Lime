"use client";

import { useState } from "react";

interface EmailOption {
  email_id: string;
  subject: string;
}

interface ClassifyResponse {
  category: string;
  confidence: number | null;
  needs_review: boolean;
}

const PROVIDERS = [
  { id: "jev", label: "Jev（TypeSafe 结构化决策）" },
  { id: "claude", label: "Claude（Anthropic，对照）" },
];

const CATEGORY_LABELS: Record<string, { name: string; desc: string }> = {
  BL_COMPARISON: { name: "BL 核对", desc: "发来 BL 草稿，要求核对/确认其与 SI 是否一致" },
  SI_REQUEST: { name: "SI 往来", desc: "发来或索取装运指示（SI）" },
  INVOICE_QUERY: { name: "发票询问", desc: "询问发票、费用、付款相关事宜" },
  GENERAL: { name: "一般业务", desc: "其他正常航运业务往来" },
  SPAM: { name: "垃圾邮件", desc: "广告、钓鱼或与航运业务无关" },
};

export function JevLabPanel({ emails }: { emails: EmailOption[] }) {
  const [emailId, setEmailId] = useState(emails[0]?.email_id ?? "");
  const [provider, setProvider] = useState("jev");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [ranProvider, setRanProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runClassification() {
    setLoading(true);
    setError(null);
    setResult(null);
    setRanProvider(null);
    try {
      const res = await fetch("/features/classification/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_id: emailId, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setResult(data as ClassifyResponse);
      setRanProvider(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-400">样例邮件</span>
            <select
              value={emailId}
              onChange={(e) => setEmailId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {emails.map((email) => (
                <option key={email.email_id} value={email.email_id}>
                  {email.email_id} — {email.subject.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-400">用哪个模型</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={runClassification}
          disabled={loading || !emailId}
          className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
        >
          {loading ? "运行中..." : "运行分类"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          出错了：{error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-gray-900 px-2 py-1 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900">
              {CATEGORY_LABELS[result.category]?.name ?? result.category}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {result.category}
            </span>
            <span
              className={
                "ml-auto rounded-md px-2 py-1 text-xs font-medium " +
                (result.needs_review
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                  : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200")
              }
            >
              {result.needs_review ? "需人工介入" : "可自动处理"}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {CATEGORY_LABELS[result.category]?.desc ?? "未知类别"}
          </p>

          {result.confidence !== null ? (
            <div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>置信度（Jev 校准概率）</span>
                <span>{Math.round(result.confidence * 100)}%</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className="h-2 rounded-full bg-gray-900 dark:bg-gray-100"
                  style={{ width: `${Math.round(result.confidence * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              该模型（{ranProvider}）不返回校准置信度，所以没有人工介入判断。
            </p>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
              原始 JSON 返回
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-gray-100 p-3 text-xs dark:bg-gray-900">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
