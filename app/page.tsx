import Link from "next/link";
import { MarketingNav } from "./_components/marketing-nav";
import { OrbField } from "./_components/orb-field";
import { Reveal } from "./_components/reveal";
import { ContactForm } from "./_components/contact-form";

const HERO_STATS = [
  { value: "3", unit: "大核心模块", detail: "分类 · 抽取 · 比对" },
  { value: "5", unit: "个 LLM Provider", detail: "Claude / GPT / DeepSeek / Gemini / 本地" },
  { value: "3", unit: "种接入方式", detail: "Web · REST API · MCP" },
  { value: "0", unit: "登录门槛体验", detail: "Demo 无需注册" },
];

const FEATURES = [
  {
    href: "/features/classification",
    tag: "STEP 01 · CLASSIFY",
    title: "邮件分类",
    desc: "自动判断来信是 SI、BL 确认、发票询问、一般询问，还是垃圾邮件，把该关注的先挑出来。",
    icon: (
      <path
        d="M4 6h16v12H4V6Zm0 0 8 7 8-7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/features/extraction",
    tag: "STEP 02 · EXTRACT",
    title: "字段抽取",
    desc: "从正文与附件里抽出 shipper、consignee、notify party、装卸港、箱量、重量等关键字段。",
    icon: (
      <path
        d="M5 5h14M5 10h14M5 15h9M5 20h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/features/comparison",
    tag: "STEP 03 · COMPARE",
    title: "比对确认",
    desc: "逐字段比对 BL 与 SI，标出差异，拿不准的地方直接提示需要人工介入，不做静默假设。",
    icon: (
      <path
        d="M8 4v12a2 2 0 0 0 2 2h6M4 8l4-4 4 4M20 16l-4 4-4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

const SURFACES = [
  {
    title: "Web UI",
    desc: "响应式界面，手机、电脑都能核验单证",
    note: "app/features/*/ui",
  },
  {
    title: "REST API",
    desc: "把三步能力包装成 HTTP 接口给其他系统调用",
    note: "POST /features/*/api",
  },
  {
    title: "MCP Server",
    desc: "同一套能力暴露成 MCP tool，供 AI agent 直接调用",
    note: "Streamable HTTP",
  },
];

const PROCESS = [
  { step: "01", title: "收件即分类", desc: "邮件进来先判断类型，垃圾邮件和无关询问不进入后续流程" },
  { step: "02", title: "结构化抽取", desc: "正文与附件（PDF/Word/Excel）一起解析，抽出核验需要的字段" },
  { step: "03", title: "差异一目了然", desc: "BL 与 SI 并排比对，差异高亮，拿不准的字段标记待人工确认" },
];

export default function LandingPage() {
  return (
    <div className="bg-paper text-ink">
      <MarketingNav />

      {/* ---------- Hero ---------- */}
      <section id="product" className="relative overflow-hidden">
        <OrbField tone="light" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white/70 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-ink/60 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              Averis × Monash Hackathon 2026
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
              把 <span className="text-gradient">BL</span> 和{" "}
              <span className="text-gradient">SI</span> 的每一个字段，
              <br className="hidden sm:block" />
              对齐。
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink/65 sm:text-lg">
              航运单证核验系统：自动分类往来邮件、从正文与附件里抽取关键字段、比对提单与托书的差异，
              拿不准的地方主动提示人工介入——不是替代操作人员，是替他们先把活儿理清楚。
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="group relative overflow-hidden rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-ink/10 transition hover:shadow-xl hover:shadow-indigo/30"
              >
                <span className="relative z-10">进入系统 →</span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-indigo to-royal transition-transform duration-300 group-hover:translate-x-0" />
              </Link>
              <a
                href="https://github.com/xbl2602/Hackathon"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-hairline px-7 py-3.5 text-sm font-semibold text-ink/80 transition hover:border-ink/30 hover:text-ink"
              >
                查看源码
              </a>
              <span className="text-xs text-ink/45">无需登录即可体验 Demo</span>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-16 grid grid-cols-2 gap-6 border-t border-hairline pt-8 sm:grid-cols-4">
              {HERO_STATS.map((s) => (
                <div key={s.unit}>
                  <div className="text-3xl font-extrabold text-ink">
                    {s.value}
                    <span className="ml-1 text-sm font-semibold text-indigo">{s.unit}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink/50">{s.detail}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- About / product brief ---------- */}
      <section id="about" className="border-y border-hairline bg-veil/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-indigo">What we built</span>
              <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                一套流水线，
                <br />
                三种打开方式。
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink/60">
                同一套分类→抽取→比对能力，只写一遍业务逻辑，分别包一层暴露成网页、API 和 MCP
                tool。团队 3 人 4 天做出来的黑客松原型，目标是能跑、能被验证、代码结构不糊。
              </p>
              <div className="mt-6 flex gap-8">
                <div>
                  <div className="text-2xl font-bold">4 天</div>
                  <div className="text-xs text-ink/50">从题目公布到提交</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">3 人</div>
                  <div className="text-xs text-ink/50">零编程背景起步</div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="grid gap-4 sm:grid-cols-3">
              {SURFACES.map((s) => (
                <div
                  key={s.title}
                  className="group rounded-2xl border border-hairline bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo/10"
                >
                  <div className="text-sm font-bold text-ink">{s.title}</div>
                  <p className="mt-2 text-xs leading-relaxed text-ink/55">{s.desc}</p>
                  <div className="mt-4 font-mono text-[10px] text-indigo/70">{s.note}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Feature cards ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <span className="font-mono text-[11px] uppercase tracking-widest text-indigo">Core pipeline</span>
          <h2 className="mt-3 max-w-lg text-3xl font-bold leading-tight sm:text-4xl">
            三步一起跑，也能单独用。
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.href} delay={i * 100}>
              <Link
                href={f.href}
                className="group block h-full rounded-2xl border border-hairline bg-white p-7 transition hover:-translate-y-1.5 hover:border-indigo/40 hover:shadow-xl hover:shadow-indigo/10"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo to-royal text-white shadow-sm transition group-hover:scale-110">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    {f.icon}
                  </svg>
                </div>
                <div className="mt-5 font-mono text-[10px] uppercase tracking-widest text-indigo/70">{f.tag}</div>
                <h3 className="mt-2 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/55">{f.desc}</p>
                <div className="mt-5 text-sm font-semibold text-ink/70 transition group-hover:text-indigo">
                  了解更多 <span className="transition group-hover:translate-x-1 inline-block">→</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <Link
            href="/features/verification"
            className="mt-6 flex items-center justify-between rounded-2xl border border-hairline bg-gradient-to-r from-veil to-white p-6 transition hover:border-indigo/40"
          >
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-indigo/70">All-in-one</div>
              <div className="mt-1 font-bold">▶ 完整流水线：一键跑完全部样例邮件</div>
            </div>
            <span className="text-xl text-ink/40 transition group-hover:text-indigo">→</span>
          </Link>
        </Reveal>
      </section>

      {/* ---------- Violet statement block ---------- */}
      <section className="relative overflow-hidden bg-ink py-24 text-white">
        <OrbField tone="dark" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal>
            <span className="font-mono text-[11px] uppercase tracking-widest text-halo">Built for accuracy</span>
            <h2 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
              邮件读得懂，
              <br />
              差异<span className="text-gradient">藏不住</span>。
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-whisper">
              没有 LLM key 时自动退回本地规则引擎兜底，批量处理有并发上限、单条失败不拖垮整批，
              系统始终给出一个能看懂的结果，而不是一片空白。
            </p>
          </Reveal>

          <Reveal delay={150}>
            <div className="mt-14 grid grid-cols-2 gap-8 border-t border-white/10 pt-8 sm:grid-cols-4">
              {[
                { v: "≤5", l: "并发批量上限" },
                { v: "100%", l: "离线规则引擎兜底" },
                { v: "0", l: "静默吞错场景" },
                { v: "upsert", l: "并发安全落库" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-bold text-white sm:text-3xl">{s.v}</div>
                  <div className="mt-1 text-xs text-whisper/70">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <span className="font-mono text-[11px] uppercase tracking-widest text-indigo">How it works</span>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">从收件箱到结论，三步。</h2>
        </Reveal>

        <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-hairline sm:block" />
          {PROCESS.map((p, i) => (
            <Reveal key={p.step} delay={i * 120}>
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline bg-paper font-mono text-sm font-bold text-indigo">
                  {p.step}
                </div>
                <h3 className="mt-4 font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/55">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section id="contact" className="border-t border-hairline bg-veil/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <span className="font-mono text-[11px] uppercase tracking-widest text-indigo">Get in touch</span>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              有想法？
              <br />
              我们在听。
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/60">
              这是黑客松演示项目，下面的表单只是前端效果，还没接后端。想认真聊聊的话，
              欢迎直接去仓库开 issue。
            </p>
            <a
              href="https://github.com/xbl2602/Hackathon"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo hover:underline"
            >
              github.com/xbl2602/Hackathon ↗
            </a>
          </Reveal>
          <Reveal delay={120}>
            <ContactForm />
          </Reveal>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo to-halo text-xs font-bold text-ink">
                  航
                </span>
                Shipping Doc Verifier
              </div>
              <p className="mt-3 max-w-xs text-sm text-whisper/70">
                Averis × Monash Hackathon 2026 — 航运单证核验，分类、抽取、比对一次跑通。
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-whisper/50">产品</div>
              <ul className="mt-3 space-y-2 text-sm text-whisper/80">
                <li><Link href="/features/classification" className="hover:text-white">邮件分类</Link></li>
                <li><Link href="/features/extraction" className="hover:text-white">字段抽取</Link></li>
                <li><Link href="/features/comparison" className="hover:text-white">比对确认</Link></li>
                <li><Link href="/features/verification" className="hover:text-white">完整流水线</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-whisper/50">账户</div>
              <ul className="mt-3 space-y-2 text-sm text-whisper/80">
                <li><Link href="/login" className="hover:text-white">登录（演示）</Link></li>
                <li><Link href="/signup" className="hover:text-white">注册（演示）</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">直接进入系统</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-whisper/50">关于</div>
              <ul className="mt-3 space-y-2 text-sm text-whisper/80">
                <li>
                  <a href="https://github.com/xbl2602/Hackathon" target="_blank" rel="noreferrer" className="hover:text-white">
                    GitHub 仓库 ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-whisper/50 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 Averis × Monash Hackathon Team</span>
            <span>Built with Next.js · Supabase · Vercel AI SDK</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
