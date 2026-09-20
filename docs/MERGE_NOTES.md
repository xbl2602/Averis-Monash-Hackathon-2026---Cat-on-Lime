# 合并记录（2026-09-20）

这份文件记录 2026-09-20 把队友A的前端分支合并进 `main` 时做了什么、为什么这么做、以及接下来要注意什么。
不用记住全部，只要出问题时知道"回来翻这份文件"就够了。

## 先看这里：后端在队友A拉分支之后新增了什么（给队友A / 队友B）

时间线：队友A的分支从 `cef6586`（加 Jev 验证页那次）拉出来。**从那之后，后端在 `main` 上又做了 12 个提交**，
这些能力队友A本地看不到，合并后全部生效。一句话总结：**分类→抽取→比对全流程已能整批判量、评测达标、结果可查可导出，
REST + MCP 都已上线**。新增能力清单：

| # | 新能力 | 对队友来说意味着什么 |
|---|---|---|
| 1 | **整箱批量入口** `POST /features/pipeline/api` 与 MCP tool `run_batch` | 之前只能一封封跑；现在可以一次跑一批（默认最多 50 封/次，带 `remaining` 提示还剩多少）。**`/features/verification` 页面要接的就是它**（支持 `provider` 选择、`dry_run` 只预览不写库、`limit` 控制数量、并发上限） |
| 2 | **结果查询模块**（新 feature：`app/features/results/`） | 新增 4 个只读 REST 接口：`/features/results/api`（列表/排序/分页）、`/stats`（统计）、`/conflicts`（冲突对）、`/export`（导出 json/md/txt）。网页上想做"结果看板/导出按钮"直接调这些 |
| 3 | **比对引擎 v4** + 规则引擎 | 分类/比对改为"本地规则优先 → Jev 判断 → LLM 兜底"三层；没有 LLM key 也能靠规则跑。评测成绩：分类 macro-F1 100%、端到端 520/520 |
| 4 | **数据层落地 Supabase**（3 张表 + 1 视图 + 缓存表） | `raw_emails`（原始邮件）、`parsed_attachments`（附件文字）、`verification_results`（结果）、只读视图 `verification_overview`、缓存 `llm_call_cache`。导入脚本支持增量（内容没变就跳过） |
| 5 | **附件解析打通** TXT/PDF/Word/Excel | 抽取模块现在真能读附件内容（含两个服务端 PDF 解析 bug 的根治），不再只靠正文 |
| 6 | **MCP server 接上真实握手** | 共 8 个 tool（7 个只读 + 1 个 `run_batch` 写库），地址 `/core/mcp-server`，线上 https://hackathonaveris.vercel.app/core/mcp-server 。验证脚本：`npm run mcp:smoke` |
| 7 | **本地评测脚本** `npm run evaluate` | 对照官方 ground_truth 全量 520 封自测（仅自测用，不进提交文件），出分数并写库；参数 `--force` / `--limit=50` / `--no-write` |
| 8 | **多 LLM provider 配置化** | Claude / OpenAI / DeepSeek / Gemini / 本地 LM Studio / Jev 都能在接口参数里选。本地缺 key 会自动降级不影响规则路径；线上 Claude/OpenAI/DeepSeek 还缺 key（选它们会返回可读的缺 key 提示，不是崩溃） |

**队友A需要知道的两个接口细节**（做 `/features/verification` 页面时用）：
- `POST /features/pipeline/api` 请求体（全部可选）：`{ email_ids?, limit?, force?, dry_run?, provider?, concurrency? }`，
  返回 `RunBatchSummary`（selected / skipped / ran / succeeded / failed / wrote / remaining）
- 完整格式见 `SHARED_INTERFACES.md`「pipeline 模块（批量入口）」

**队友B（写 README/演示材料）需要知道的**：上面这些能力在 README 里有更详细的说明和 curl 示例，
"当前状态"一节的数据可以直接引用；官方 ground_truth 只用于自测、不进提交、演示时不要展示对照答案。

## 第二阶段新增（config / mail / import）——动手前先读这些文档（2026-09-20 晚更新）

后端后来又加了第二阶段三个模块，**队友A / 队友B 的本地分支看不到这些，动手前先读文档、不要靠猜**：

| 模块 | 是什么 | 界面归谁 |
|---|---|---|
| **config** | 配置中心：15 项运行时配置（LLM 优先级、阈值、各 API key、并发/上传限制），敏感值加密存储、读开放/写口令 | 配置页 → 队友A（待做） |
| **mail** | 占位接口：Gmail 连接状态、多 Supabase 项目切换与停用恢复 | 设置页 → 队友A（待做） |
| **import** | 文档上传：单件/多选/文件夹、原文件存 Supabase Storage、按内容识别 SI/BL、人工归类 | 上传页 → 队友A（待做） |

**要看什么、看哪里（按角色）——这就是"必读清单"**：

| 谁 | 必读文档 | 具体看哪几节 |
|---|---|---|
| 队友A（做配置页/上传页） | `SHARED_INTERFACES.md` | 「config 模块」「mail 模块」「import 模块」三节（接口路径、参数、返回格式） |
| 队友A（做配置页/上传页） | `SHARED_INTERFACES.md` | 「写保护（所有第二阶段写接口共用）」小节——**GUI 写数据用 Server Action 或服务端注入 token，别让 token 进浏览器** |
| 队友A（做配置页/上传页） | `PHASE2_SPEC.md` | 第 1 节（安全模型：读开放/写口令）、第 2 节（加密方案）、第 8 节（验收清单） |
| 队友B（README/演示材料） | `README.md` | "当前状态"里第二阶段条目（可直接引用） |
| 队友B（README/演示材料） | `PHASE2_SPEC.md` | 第 8 节验收清单（哪些能力已验收、哪些是占位） |
| 所有人 | 本文件 | 本节 + 下方【注意事项】 |

**已经准备好、不需要你们做的**：
- 4 张新表 + `uploads` bucket 已建好（RLS 已启用）；线上环境变量 `ENCRYPTION_MASTER_KEY` / `ADMIN_TOKEN` 已由后端配好（2026-09-20），**不用自己申请**
- MCP tool 从 8 个 → **11 个**（新增 `sync_gmail`、`list_uploaded_documents`、`classify_uploaded_document`）；原主流水线（分类→抽取→比对）无变化，评测仍 520/520
- 写接口需要管理员口令（存在 Vercel 环境变量里，GUI 走服务端自动带上）；手动 curl 测试需要口令时找操作者

## 合并了什么（前端）

**前端（队友A）**：`origin/FRONTEND-BY-WJ` 分支的 1 个提交（`0d703c5`），
从 `cef6586` 拉出来独立开发，现在整个合并进 `main`。具体新增/改动的功能：

### 1. 全新的营销首页 `/`（重做，原来是简单功能列表页）

- 六大区块：Hero 区（大标题 + 两个按钮）、产品简介（"一套流水线，三种打开方式"）、
  三步功能卡片（分类/抽取/比对）、紫色数据宣言区、流程图（01→02→03）、联系表单 + 页脚
- 页脚链接到登录/注册/GitHub/各功能页
- 注意：**联系表单是纯前端效果，没有接后端**，收不到任何消息（页面上也如实写了）
- 注意：底部有一条"▶ 完整流水线：一键跑完全部样例邮件"的大入口，指向 `/features/verification`

### 2. 全新控制台 `/dashboard`（新增，之前没有这个页面）

- 左侧深色侧边栏（移动端是抽屉式，点汉堡按钮展开）：总览 + 5 个功能模块入口
- 顶栏：搜索框 + "演示账户"头像下拉菜单
- 主区功能网格：搜索框输入关键词会**实时过滤**功能卡片（纯前端过滤，不发请求）
- 统计卡片显示**真实后端数据**：
  - 样例邮件总数：来自 `listSampleEmails()`（main 上的真数据）
  - 已配置 LLM 数量：用 `isProviderConfigured()` → 这就是本次合并必须补那个函数的原因
- 注意：点"演示账户 → 退出登录"会去 `/login`；头像上写"演示账户"、菜单里写 `demo@shipping-doc.local`

### 3. 登录 / 注册演示页 `/login`、`/signup`（新增）

- 只有界面和表单效果，**没有接真实鉴权**，随便输都能"通过"或只是本地展示
- 演示时说"这是演示界面"即可，不要当成系统已有登录功能

### 4. 全局视觉重构

- 新增设计系统颜色（`app/globals.css`）：`paper / ink / indigo / royal / halo / mint / veil / hairline` 等，
  以及漂浮光晕、滚动淡入等纯 CSS 动画
- 新增全局字体：正文 Plus Jakarta Sans、小标签 JetBrains Mono（通过 next/font 加载）
- **路由外壳重构（重要）**：原来根布局 `app/layout.tsx` 给所有页面套统一的顶部导航；
  现在改为每个区块自己管：
  - 营销首页 `/`：自带 `MarketingNav`
  - `/dashboard`：自带侧边栏外壳 `app/dashboard/layout.tsx`
  - `/features/*`：**保留原来的顶部导航**（新增 `app/features/layout.tsx` 包住），
    原来的分类/抽取/比对/Jev 页面一行代码没改，打开还是老样子

### 5. 新增的可复用界面组件（都在 `app/_components/`）

`marketing-nav`（首页导航）、`orb-field`（背景光晕）、`reveal`（滚动淡入）、
`auth-shell` + `auth-form`（登录注册壳与表单）、`contact-form`（联系表单）
——都是展示层组件，不含业务逻辑，其他地方想用可以直接 import

### 合并方式与冲突情况

- **合并方式**：`git merge --no-ff`，产生合并提交 `058ac8a`
  - 用 `--no-ff` 是为了留一个明确的合并记录，以后想回退这一步很容易
- **冲突情况**：零冲突。前端只改了 `app/` 下的界面文件，没碰后端（`logic/api/mcp`），分层分工起作用了
- **对后端的影响**：只有 `app/dashboard/page.tsx` 一处 import 了后端（`listSampleEmails`、`isProviderConfigured`），
  除此之外两端互不依赖

## 这次合并额外修的东西

1. **`lib/llm/index.ts` 补了 `isProviderConfigured()`**（提交 `8cb43dc`）
   - 原因：前端控制台用它统计"几个 LLM provider 配好了 key"，但后端这边一直没导出这个函数，
     直接合并会 `npm run typecheck` 报错，`main` 就"跑不起来"了，违反"main 随时能跑"的约定
   - 做法：按 provider 映射到 .env.example 里已有的环境变量名；Jev 复用已有的 `isJevAvailable()`，
     LM Studio 复用 `isLocalLLMAvailable()`（它不需要 key）
2. **删了旧的 `.next` 构建缓存并重新 `npm run build`**
   - 原因：见下面"注意事项"第 1 条

## 注意事项（重要）

1. **如果 `npm run typecheck` 报 `.next/...` 文件里的错，先删 `.next` 再试**
   - 这是 Next.js 的缓存过期问题，不是代码坏了。`.next/types/` 和 `.next/dev/types/` 会各生成一份路由表，
     路由改过（比如这次新增 `/dashboard`）之后旧的那份就对不上了
   - 处理办法：删掉整个 `.next` 文件夹（它本来就不进 git），然后重新 `npm run build` 或 `npm run dev` 即可
2. **`/features/verification` 这个页面还不存在，现在点会 404**
   - 前端有 7 处链接指向它（首页、导航、侧边栏、顶栏、dashboard、页脚）
   - 后端能力已经有了：`app/features/pipeline/`（接口 `POST /features/pipeline/api`，整批跑分类→抽取→比对→写库），
     但缺一个网页界面
   - ⚠️ 这个页面的归属要先和队友A说好（UI 层按分工归他），两边都别闷头做，免得白干或冲突
3. **队友A如果继续在前端分支上改代码，请先从合并后的最新 `main` 拉新分支**
   - 两边都在改同一个文件夹的话，以后合并容易撞车
4. **登录/注册是演示界面**：没有接真实鉴权，不要拿它当"系统有登录功能"来演示（详见上面"合并了什么"第 3 条）
5. **`origin/BACKEND` 和 `origin/UIUX` 两个远程分支已经全部在 `main` 里了**，没有独有内容。
   想删掉它们保持整洁可以删，但不急

## 合并后怎么验证（打开线上 demo 走一遍）

线上地址：https://hackathonaveris.vercel.app

- [ ] 首页 `/`：新营销页正常显示，Hero/三个功能卡片/联系表单/页脚都在，手机宽度下排版不乱
- [ ] 控制台 `/dashboard`：侧边栏、搜索过滤功能卡片、右上角"演示账户"菜单都正常；统计数字不是明显的 0 或报错
- [ ] 三个功能页 `/features/classification`、`/features/extraction`、`/features/comparison`：打开还是原来的样子（顶部导航在、功能没坏）
- [ ] 移动端（手机浏览器或开发者工具切窄屏）：首页和控制台都能正常滚动、侧边栏能展开收起
- [ ] 已知会 404：`/features/verification`（见注意事项第 2 条，属于待办，不是合并事故）

## TODO

- [x] 第二阶段后端（config / mail / import）：完成并验收（2026-09-20）；线上环境变量 `ENCRYPTION_MASTER_KEY` / `ADMIN_TOKEN` 已配好
- [ ] 队友A：做配置页（config）与上传页（import）——接口已就绪，先读上面「第二阶段必读清单」
- [ ] 确定 `/features/verification` 页面由谁做：决定后把结论写到 SHARED_INTERFACES.md 或这里
- [ ] 做 `/features/verification` 页面（接 `POST /features/pipeline/api`；需求方输入：跑哪几封、最多几封、用哪个 provider、要不要 dry_run；展示：本次成功/失败/剩余多少封）
- [ ] 给 Claude / OpenAI / DeepSeek 申请 API key 并填到 Vercel（环境变量写 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`，见 .env.example）
- [ ] 顺手看一眼控制台统计数字：合并后在 `/dashboard` 确认"已配置 LLM"数量显示合理（云端应显示 Jev + Gemini 等已配的）

2026-09-20：UI 侧待办（7 处 `/features/verification` 死链清单、写保护约定、验收路径、remaining 两种成因）见 `UI_HANDOFF.md`。
