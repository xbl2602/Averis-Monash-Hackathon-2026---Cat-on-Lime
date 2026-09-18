import Link from "next/link";

const FEATURES = [
  {
    href: "/features/classification",
    title: "1. 邮件分类",
    desc: "判断邮件是 SI、BL确认、发票询问、一般询问还是垃圾邮件",
  },
  {
    href: "/features/extraction",
    title: "2. 字段抽取",
    desc: "从邮件正文/附件里抽取 shipper、consignee、port of loading 等字段",
  },
  {
    href: "/features/comparison",
    title: "3. 比对确认",
    desc: "比对 BL 与 SI 的字段，标出差异，拿不准时提示人工介入",
  },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">航运单证核验</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Averis x Monash Hackathon 2026 — 核心框架骨架，具体功能待3人分别开发。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-lg border border-gray-200 p-4 transition hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600"
          >
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
