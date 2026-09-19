import Link from "next/link";
import { listSampleEmails } from "@/lib/shared/inbox";
import { LLM_PROVIDERS, isProviderConfigured } from "@/lib/llm";
import { FeatureGrid, type FeatureTile } from "./_components/feature-grid";

// 每次打开都重新读环境变量/样例数据，控制台首页的数字要是真实当前状态
export const dynamic = "force-dynamic";

const TILES: FeatureTile[] = [
  {
    href: "/features/verification",
    tag: "ALL-IN-ONE",
    title: "▶ 完整流水线",
    desc: "一键处理全部样例邮件：分类 → 抽取 → 比对，本地评分并导出 submission.json",
    accent: "var(--color-indigo)",
  },
  {
    href: "/features/classification",
    tag: "STEP 01",
    title: "邮件分类",
    desc: "判断邮件是 SI、BL确认、发票询问、一般询问还是垃圾邮件",
    accent: "var(--color-mint)",
  },
  {
    href: "/features/extraction",
    tag: "STEP 02",
    title: "字段抽取",
    desc: "从邮件正文/附件里抽取 shipper、consignee、port of loading 等字段",
    accent: "var(--color-amber)",
  },
  {
    href: "/features/comparison",
    tag: "STEP 03",
    title: "比对确认",
    desc: "比对 BL 与 SI 的字段，标出差异，拿不准时提示人工介入",
    accent: "var(--color-halo)",
  },
  {
    href: "/features/jev-lab",
    tag: "LAB",
    title: "Jev 验证",
    desc: "用样例邮件对照 Jev 结构化决策模型与 Claude 的分类效果",
    accent: "var(--color-royal)",
  },
];

const SURFACES = [
  { title: "Web UI", detail: "响应式界面 · 手机/电脑都能用" },
  { title: "REST API", detail: "/features/*/api · HTTP 接口" },
  { title: "MCP Server", detail: "Streamable HTTP · AI agent 可调用" },
];

export default async function DashboardPage() {
  const emails = await listSampleEmails();
  const configuredCount = LLM_PROVIDERS.filter((p) => isProviderConfigured(p.id)).length;

  const stats = [
    { label: "样例邮件", value: emails.length, note: "待处理 / 已加载" },
    { label: "已配置 LLM", value: `${configuredCount}/${LLM_PROVIDERS.length}`, note: "provider 就绪情况" },
    { label: "核心模块", value: 3, note: "分类 · 抽取 · 比对" },
    { label: "接入方式", value: 3, note: "Web · API · MCP" },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-halo/80">Control room</span>
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">控制台总览</h1>
          <p className="mt-2 max-w-xl text-sm text-whisper/60">
            航运单证核验 — 没有配置 API key 时，系统会自动退回本地规则引擎，保证流程始终能跑通。
          </p>
        </div>
        <Link
          href="/features/verification"
          className="group inline-flex items-center gap-2 self-start rounded-full bg-gradient-to-r from-indigo to-royal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo/20 transition hover:shadow-indigo/40"
        >
          运行完整流水线
          <span className="transition group-hover:translate-x-1 inline-block">→</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-hairline-dark bg-ink-soft p-5">
            <div className="text-2xl font-extrabold text-white sm:text-3xl">{s.value}</div>
            <div className="mt-1 text-sm font-medium text-whisper/70">{s.label}</div>
            <div className="mt-0.5 text-xs text-whisper/40">{s.note}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">功能模块</h2>
          <span className="text-xs text-whisper/40">点击进入对应模块</span>
        </div>
        <FeatureGrid tiles={TILES} />
      </div>

      <div className="rounded-2xl border border-hairline-dark bg-gradient-to-br from-ink-soft to-ink p-6 sm:p-8">
        <h2 className="text-lg font-bold text-white">同一套能力，三种接入方式</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {SURFACES.map((s) => (
            <div key={s.title} className="rounded-xl border border-hairline-dark bg-white/5 p-4">
              <div className="text-sm font-bold text-white">{s.title}</div>
              <div className="mt-1.5 font-mono text-xs text-whisper/50">{s.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
