"use client";

import { useState } from "react";

// 一组会产生 MISMATCH 的示例数据，方便验证比对逻辑接线是否正常
const EXAMPLE_SI = { shipper: "APRIL Fine Paper", consignee: "ABC Trading Co" };
const EXAMPLE_BL = { shipper: "APRIL Fine Paper", consignee: "XYZ Trading Co" };

export function ComparisonPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExample() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/features/comparison/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ si: EXAMPLE_SI, bl: EXAMPLE_BL }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        这里目前是最简单的字符串完全相等比较，还没有处理格式差异/缺失字段等情况。
        负责人可以在 <code>app/features/comparison/logic/index.ts</code> 里替换。
      </div>
      <button
        onClick={runExample}
        disabled={loading}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
      >
        {loading ? "运行中..." : "用示例数据（consignee 故意不一样）运行比对"}
      </button>
      {error && <p className="text-sm text-red-600">出错了：{error}</p>}
      {result && (
        <pre className="overflow-auto rounded-md bg-gray-100 p-4 text-sm dark:bg-gray-900">
          {result}
        </pre>
      )}
    </div>
  );
}
