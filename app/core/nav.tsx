import Link from "next/link";

// 全局导航——所有人共用，改动前先跟操作者确认（见 CLAUDE.md "公共区"规则）
const FEATURES = [
  { href: "/features/classification", label: "邮件分类" },
  { href: "/features/extraction", label: "字段抽取" },
  { href: "/features/comparison", label: "比对确认" },
];

export function Nav() {
  return (
    <nav className="border-b border-gray-200 dark:border-gray-800">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold">
          Shipping Doc Verifier
        </Link>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href} className="hover:underline">
              {f.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
