import Link from "next/link";

// 全局导航——所有人共用，改动前先跟操作者确认（见 CLAUDE.md "公共区"规则）
// 现在只在 /features/* 页面下使用（见 app/features/layout.tsx），
// 控制台首页 /dashboard 用的是自己的侧边栏（app/dashboard/_components/sidebar.tsx）
const FEATURES = [
  { href: "/features/verification", label: "完整流水线" },
  { href: "/features/classification", label: "邮件分类" },
  { href: "/features/extraction", label: "字段抽取" },
  { href: "/features/comparison", label: "比对确认" },
  { href: "/features/jev-lab", label: "Jev 验证" },
];

export function Nav() {
  return (
    <nav className="border-b border-hairline bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo to-royal text-xs font-bold text-white">
            航
          </span>
          Shipping Doc Verifier
        </Link>
        <div className="flex flex-wrap gap-x-1 gap-y-2 text-sm">
          {FEATURES.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="rounded-full px-3 py-1.5 text-ink/65 transition hover:bg-veil hover:text-ink"
            >
              {f.label}
            </Link>
          ))}
        </div>
        <Link href="/dashboard" className="ml-auto text-sm font-medium text-indigo hover:underline">
          ← 控制台
        </Link>
      </div>
    </nav>
  );
}
