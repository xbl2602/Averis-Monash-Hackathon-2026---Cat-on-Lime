# 历史记录（合并存档）

> 用途：一次性记录 / 会议纪要 / 审计快照的合集，**只读历史**，不要回头改这里的内容；新记录追加到对应 Part 末尾。
> 合并了原 `MERGE_NOTES.md` / `WORKSHOP_1_CLOUD_HOSTING_NOTES.md` / `COUNCIL_AUDIT_2026-09-21.md`，2026-09-21 晚追加 `WORKSHOP_2`（Averis 题目答疑专场）。
> 归档时间：2026-09-21。

---

## 合并记录（2026-09-20）

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
| 队友A（做配置页/上传页） | `SHARED_INTERFACES.md` | 「写保护（所有第二阶段写接口共用）」小节——**写入口推荐不做；要做就由操作者手动输入口令、服务端校验后带 token；禁止匿名可触发的自动注入** |
| 队友A（做配置页/上传页） | `PHASE2_SPEC.md` | 第 1 节（安全模型：读开放/写口令）、第 2 节（加密方案）、第 8 节（验收清单） |
| 队友B（README/演示材料） | `README.md` | "当前状态"里第二阶段条目（可直接引用） |
| 队友B（README/演示材料） | `PHASE2_SPEC.md` | 第 8 节验收清单（哪些能力已验收、哪些是占位） |
| 所有人 | 本文件 | 本节 + 下方【注意事项】 |

**已经准备好、不需要你们做的**：
- 4 张新表 + `uploads` bucket 已建好（RLS 已启用）；线上环境变量 `ENCRYPTION_MASTER_KEY` / `ADMIN_TOKEN` 已由后端配好（2026-09-20），**不用自己申请**
- MCP tool 从 8 个 → **11 个**（新增 `sync_gmail`、`list_uploaded_documents`、`classify_uploaded_document`）；原主流水线（分类→抽取→比对）无变化，评测仍 520/520
- 写接口需要管理员口令（存在 Vercel 环境变量里；GUI 推荐不做写入口，要做也必须由操作者手动输入口令，不允许匿名自动带 token）；手动 curl 测试需要口令时找操作者

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


---

## Workshop 1 纪要：云托管与部署实操（2026-09-20 线上 workshop）

来源：官方 workshop 录音转录文本（会议记录）。本文件是整理后的重点摘要，不是逐字稿；原始转录含较多语音识别错误，已按上下文修正，修正对照见第 0 节。

---

## 0. 语音识别修正对照

| 转录原文 | 应为 | 说明 |
|---|---|---|
| Verso / Versal / Versa / Varsal / versil.json | **Vercel / vercel.json** | 托管平台名，被识别出多种拼法 |
| Superbase | **Supabase** | 数据库平台 |
| Spotify（"Spotify does support dynamic web hosting"） | **Netlify**（按上下文推断） | 当时正在回答关于 Netlify 的提问 |
| Everts / Everest | **Averis** | 主办方，与开幕式纪要同一处识别错误 |
| Tarek | **可能是 Sharik**（推断） | Darren 讲解时引用同事，名字疑似听错 |
| index.stnl | **index.html** | 讲 SPA 刷新 404 的修法 |
| LMS | **本地大模型（LM Studio 之类）** | Q&A 里说"本地模型只有本地能测" |
| 各种时间为转述 | 以官方公告为准 | 转录里时间表述有出入 |

---

## 1. 概况

- 时间：2026-09-20（距 9/22 12:00pm 提交截止约 48 小时）
- 讲者：**Sharik Naman**（概念、密钥安全、常见问题）+ **Darren**（Vercel 现场部署演示）
- 主题：云托管基础 + 实机部署演示，约 39 分钟，含现场 Q&A
- 核心主张一句话：**deploy early**——今天先把一个能打开的基础页部署上去，之后每次 push 代码，线上站点自动更新

---

## 2. 为什么必须尽早部署

- 评委不在你的电脑上、更不在你家 WiFi 里——他们会用自己的手机或办公电脑直接打开链接
- 链接必须是**公网可访问的 HTTPS**；交一个写着 `localhost:3000` 的链接等于没交
- 第一次部署大概率会遇到：构建报错、环境变量缺失、版本不支持等；留到截止前两小时才部署就是赌运气
- 现场演示者本人演示时就遇到了一次部署报错，他说这正是要提前部署的原因
- 建议：**定稿前 2~3 小时完成最后一次部署 + 复测**

---

## 3. 托管方案怎么选

| 方案 | 适合什么 | 优劣 |
|---|---|---|
| 裸云主机（如 AWS EC2） | 想要完全控制、愿意折腾 | 要自己配服务器和 SSL 证书，半天起步，黑客松不建议 |
| 前端托管平台（Vercel / Netlify） | React / Angular / Next.js 等前端页面 | 连 GitHub 即自动构建，免费 HTTPS，最省事 |
| Serverless 容器（Google Cloud Run / Render） | Python / Java / Node 后端 API | 容器化运行、自动伸缩 |

**推荐的"黑客松黄金组合"（讲者给的架构图）**：前端 Vercel（全球 CDN，打开几乎秒开）＋ 后端 Cloud Run / Render（跑文档处理、AI 逻辑、业务规则）＋ 数据库 Supabase / Postgres（存数据）。前后端分开部署的一个大好处是**可靠性**：后端处理 AI 请求慢几秒时，前端照样干净加载、显示 loading，而不是把用户晾在坏掉的页面上。

---

## 4. 密钥安全（本次最重要的一节）

1. **绝不把 .env 文件或任何密钥推上 GitHub**：公开仓库有机器人持续扫描，key 泄露后几秒内就会被盗用
2. **绝不把密钥硬编码进前端代码**：浏览器开发者工具里谁都能看到前端文件内容
3. 正确三步：
   - `.env` 写进 `.gitignore`，让它只留在自己电脑上
   - 建一个 `.env.example`，只放假的占位值，让队友知道要填哪些变量
   - 真实密钥填在**托管平台后台的 Environment Variables** 里
4. HTTPS 免费自带：部署完即有带锁图标的 URL；有自定义域名就到托管后台加 DNS 记录

---

## 5. Vercel 现场演示要点（Darren）

- 用 GitHub 账号登录 Vercel → New Project → 粘贴仓库 URL
- **Root directory 可以改**：前后端同仓库时指定前端所在子目录；前后端分开部署时，两个项目各自指向自己的目录/仓库
- Build command：本地怎么构建线上就怎么填；环境变量可以逐个填，也可以从 `.env` 批量导入
- 部署过程中的 **warning 不一定是致命的**（比如 Node 版本不再受支持，网站仍可能正常运行）；严重错误才会直接部署失败并列出原因
- **改了环境变量必须重新部署（redeploy）**——环境变量变更不会自动生效；而 push 代码是自动更新线上站点的，只有环境变量这一项是例外

---

## 6. 常见部署翻车 Top 5（附对我们的适用性）

| # | 问题 | 症状 | 官方修法 | 对 Next.js + Vercel 的我们 |
|---|---|---|---|---|
| 1 | 刷新 404 | 单页应用点着没事，刷新某个路径 404 | 加 `vercel.json` 把请求 rewrite 回 `index.html` | App Router 由框架在 Vercel 上处理路由，一般不遇到 |
| 2 | Mixed content | HTTPS 前端调 HTTP 接口被浏览器拦截 | 后端必须上 HTTPS | 我们前后端同域，天然满足 |
| 3 | 环境变量缺失 | 页面能开但 API 调用报 undefined | 核对后台变量名，然后 redeploy | 已配置；**以后新增 key 记得 redeploy** |
| 4 | 硬编码 localhost | 代码里残留旧的 localhost 地址 | 改成环境变量 | 已符合；代码里的 LM Studio localhost 是设计使然（仅本地部署可用） |
| 5 | Node 版本不一致 | 本地 Node 22、云上 Node 18 导致构建问题 | 在平台设置或 package.json 里锁定版本 | 若遇相关构建警告按此排查 |

---

## 7. API key 与云额度（官方立场）

- 主办方**不提供**任何 AI 模型额度或 API key，需要各队自己申请
- **Google Cloud 新账号有 $300 试用额度**（约 3 个月），可用于 Gemini / Vertex AI；AWS / Azure 各有自己的免费额度
- 现场提到 **xAI Grok 有免费 API 层**，可当备选
- 有人问"能不能多注册几个 Google 账号轮流用额度"——主讲人表示技术上可行，但**这有合规/封号风险，不建议采纳**；我们现有 Gemini + Jev + Supabase 的路径已够用
- 数据库/持久化：Render 之类的免费层**没有持久存储和数据库**，数据要另配 Supabase 这类服务
- 技术选型官方不限：Firebase 也可以用，拿不准的方向"先问 AI，再自己 Google 深挖"

---

## 8. 现场 Q&A 摘录

- **Vercel 能部署私有仓库吗？** 需要先用 GitHub 账号连接授权；演示里强调"确保仓库是 public"（私有库授权后也能部署，但**如果评委要看代码，仓库必须对评委可见**——我们需核实自己仓库的可见性）
- **前后端必须分开吗？** 不需要。演示用的就是前后端合在一个仓库；但分开部署更利于多人协作、减少改同一份代码的冲突，规模化/可维护性也会影响评分（对应评分里的系统设计）
- **Vercel 还是 Google Cloud？** 只部署前端/Next.js 就用 Vercel（省事）；要全栈都上 GCP 也可以，但配置工作多得多
- **Netlify？** 支持动态前端，但只有前端，不能跑后端
- **Render？** 前后端可以同平台，适合个人项目，但无持久数据库
- **提交方式**：全队**只需一名成员**填写 Google Form 提交
- **本地模型（LM Studio 等）？** 只有本地能测试；要让评委测到，必须用云端 API key 的模型（与 AGENTS.md 的"本地 LM Studio 仅本地部署可用"结论一致）
- **手机适配**：提交前用**手机 + 无痕窗口**实测一遍，确保评委和 Averis 团队能顺利打开
- **要不要用 AI/怎么用**：官方完全不限制，鼓励拿不准时先问 AI 找方向

---

## 9. Workshop 2 预告

- 时间：**9/21（周一）7:00pm**，由 **Averis 主讲**
- 内容：围绕题目/问题陈述的 **Q&A 环节**，有疑问可以当场问
- **不提供 slides，只有录播**——和题目直接相关的问题尽量当场问掉

---

## 10. 对我们项目的直接影响 / 待办清单（对照现状）

**已做到（与 workshop 建议一致）**

1. 线上 demo 已部署：`https://hackathonaveris.vercel.app`，连了 GitHub `main` 分支，push 自动重新部署——"deploy early"这条已提前执行
2. HTTPS、公网可访问：Vercel 自带；SSO 保护已关闭，不登录也能打开
3. 环境变量：Supabase / Jev 等已配在 Vercel 后台；密钥不进 git（`.env.local` 被 `.gitignore` 忽略，另有 `.env.example` 给队友占位说明）
4. 前后端同仓（Next.js 全栈），且支持本地 / 云端 / Docker 三种跑法
5. "拿不准要举手求助"、写保护口令等机制已实现——与官方强调的健壮性方向一致

**待办 / 提醒**

1. **周二提交前 2~3 小时做最终部署验证**：手机浏览器 + 无痕窗口各开一次线上 demo，把 Web / REST API / MCP 三个入口都点一遍
2. **云端 provider key**：目前 Vercel 上只有 **Gemini / Jev** 可用；若想让评委现场切换 Claude / ChatGPT / DeepSeek，需要提前把对应 key 填进 Vercel 环境变量（**改完必须 redeploy**）
3. **仓库可见性**：已核验——GitHub 仓库对未登录访客可见（public，匿名访问 HTTP 200），无需处理
4. **提交人**：Google Form 全队只需一人提交——提前定好谁交，交之前逐项核对必交材料（5 分钟内视频、可公开访问的 demo 链接、GitHub 仓库、slides/文档）
5. **去听 Workshop 2（9/21 晚 7 点）**：Averis 亲讲 + 题目 Q&A，没 slides 只有录播，别错过提问机会
6. 本地 LM Studio 只在本机 / 本地部署模式可用，这是架构限制不是 bug；线上 demo 用云端 provider（已在 AGENTS.md 说明）
7. 遇到部署报错不要慌：Vercel 会列出完整错误清单；且构建失败时线上旧版本仍可访问，不会"整站打不开"

---

## 11. 适配性分析：适用 / 注意 / 已踩雷 / 可扩展

站在我们项目现状（Next.js 全栈 + Vercel + Supabase，细节见 README 与 AGENTS.md）把 workshop 内容逐条对表。

> 本节所有判定均基于 **2026-09-20 对线上 demo（hackathonaveris 匿名访问 + 真实 provider 调用）和仓库状态的实测/核验**，不是照抄建议的理想状态。

### 11.1 逐条对表

| Workshop 建议 | 我们的现状 | 判定 |
|---|---|---|
| Deploy early、push 自动部署 | `hackathonaveris` 连了 GitHub `main`，push 即自动重新部署 | ✅ 已满足 |
| 公网 HTTPS、评委直接打开 | Vercel 自带 HTTPS，SSO 已关；2026-09-20 实测匿名访问首页 HTTP 200 | ✅ 已满足 |
| 不要交 localhost 链接 | README 首屏就是线上 demo 地址；localhost 只出现在本地跑法说明里 | ✅ 已满足 |
| 密钥不进 git | `.env.local` 已被 `.gitignore` 忽略（用 `git check-ignore` 核验过），`.env.example` 只放占位值 | ✅ 已满足 |
| 前端不硬编码密钥 | 所有 LLM key 只在服务端 `lib/llm` 读取；仓库核查：`NEXT_PUBLIC_` 仅用于 Supabase 公开地址/anon key | ✅ 已满足 |
| 出错时给能看懂的信息 | 2026-09-20 线上实测：gemini 正常 200；缺 key 的 claude / openai / deepseek 和云端不可用的 lmstudio 均返回可读中文 503，不崩 | ✅ 已满足 |
| 环境变量改了要 redeploy | 已列入下方待办第 2 条；团队加 key 时记住这一步 | ⚠️ 流程提醒 |
| 刷新 404 要加 `vercel.json` | Next.js App Router 在 Vercel 上由框架处理路由 | ➖ 不适用 |
| Mixed content（HTTPS 调 HTTP） | 前端调的是同域 `/features/*/api`，天然同协议 | ➖ 不适用 |
| Node 版本要锁 | `package.json` 已写 `engines: node >=22` | ✅ 已满足 |
| 手机 + 无痕窗口实测 | 响应式是硬性要求；提交前实测见待办第 1 条 | ⚠️ 待执行 |
| 仓库要对评委可见 | 已核验匿名访客可访问（HTTP 200，public） | ✅ 已满足 |
| 提交只需一名成员填表 | 见待办第 4 条，需提前指定提交人 | ⚠️ 待执行 |
| 用 GCP $300 / 免费额度 | 线上实测 gemini 与 jev 分类均可用（匿名调用 200）；要稳定调优可挂 GCP 额度 | 🔓 可选增强 |

### 11.2 适用但要注意（我们特有的点，workshop 没展开）

1. **Serverless 函数有时长上限，批量任务不能"一个请求跑到底"**：Vercel Hobby 函数上限 60 秒（我们的 `pipeline` / `upload` / `mcp-server` 路由已标 `maxDuration = 60`，其余 30 秒）。批量处理用的是"分块 + 轮询 + 有上限并发 + 单条失败隔离"，这是云托管里最实际的坑。
2. **无服务器实例之间不共享内存**：模块级变量不能当状态/缓存（跨请求状态已统一放 Supabase，进程内只留请求生命周期内的局部变量）。
3. **新增/更换 key 后必须 redeploy**：2026-09-20 实测，云端没 key 的 claude / openai / deepseek 都会返回 503 + 可读中文（点名缺 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`），不会崩；要给评委演示切换，需先补 key 再重新部署。
4. **云端不能用本地 LM Studio**：2026-09-20 实测返回 503 + 可读提示"只能在本地/Docker 部署模式下使用"；演示时主动说明这是架构限制，避免评委误以为功能坏了。
5. **免费层有隐性额度**：Vercel / Supabase 免费层够 demo 用；批量演示已被限制单次封顶，别连续刷太猛。
6. **构建 warning ≠ 失败**：与演示里一样的现象，以"部署成功 + Web/REST/MCP 三个入口冒烟通过"为准。

### 11.3 已经踩过的雷（复盘，均已修复）

1. **Vercel 双项目混用**：最早建的 `hackathon-demo` 没连 GitHub、不会自动更新（已停用），正式项目 `hackathonaveris` 才连了 `main`——正是 workshop 强调"连仓库、自动部署"对应的坑，我们踩过并已纠正。
2. **文档与运行时的默认值漂移**：文档一度写默认 Claude、运行时实际 Gemini——已全仓库对齐（workshop 说"以平台实际为准"，文档同理）。
3. **错误路径不体面**：Jev 返回非 JSON 时曾退化成笼统 500、附件解析失败曾回显解析器原文——已修复为统一可读文案（原始细节只进服务端日志）。
4. **文档搬家后链接失效**：团队文档统一移入 `docs/` 时根目录引用一度失效——已全量修正并核验（AGENTS / CLAUDE / README 与 docs 内互链）。

### 11.4 可扩展方向（对齐 workshop 的架构建议）

1. **后端拆分到 Cloud Run / Render**：如果决赛要把 extraction 换成 Python（PDF/OCR 生态更成熟），按 AGENTS.md 的插件约定做成独立 HTTP 服务，前端留 Vercel、后端放 Cloud Run——正好就是 workshop 推荐的架构，目录结构已为此预留。
2. **数据库**：已用 Supabase，与 workshop 推荐一致；未来换 Postgres 只是连接串变更。
3. **备选 LLM**：xAI Grok 免费层、GCP 额度下的 Gemini，都能通过现有 OpenAI 兼容适配层接入，只加配置不改架构。
4. **自定义域名**：可选加分项；HTTPS 已由 Vercel 满足，不急。
5. **日志/监控**：Vercel 后台可直接看函数日志（我们所有上游细节都打在 `console.warn`），后续可接外部监控，属决赛增强项。


---

## 审计记录（/council 把关模式 · 2026-09-21）

> 本文是 2026-09-21 全项目审计的整合存档。原始 27 份逐轮报告（round-plan-1~3 / round-diff-1）已删除，结论与遗留项已全部归并到本文。
> 审计方式：6 位评审委员（架构/可靠性/安全/产品/红队/性能）× 4 轮（方案门 3 轮 + 实现后 diff 1 轮），全项目范围。

## 结论

- diff 门 6/6 通过、0 阻断；严重问题趋势 **8 → 2 → 1 → 0**。
- 已修复：路径穿越、写保护（REST+MCP 统一收紧；匿名保留 `dry_run` 体验、封顶 20 封）、批量跑批分块 + 30s deadline + 每 20 行落库、错误文案可读但不透传上游原文、导出完整性 fail-closed、默认引擎改 Gemini 兜底、RLS 脚本。
- **机器验收（checker）按决定跳过**：结论基于 6 位委员静态代码审查 + 实现者自检（未独立复核）。提交前建议按 README「提交自检」实跑一次。

## 轮次记录

| 轮次 | 硬伤数 | 主要问题 |
|---|---|---|
| round-plan-1 | 8 | 主 CTA 死链、分类默认路径必 500、路径穿越、MCP 无鉴权写库、RLS 未验证、跑批超时全丢、导出完整性 |
| round-plan-2 | 2 | UI_HANDOFF 写模式口径、缺移动端验收 |
| round-plan-3 | 1 | deadline 截断的 ran/remaining 记账口径（已按精确修法实现并通过红队穷举验证） |
| round-diff-1 | 0 | 6 维度全部通过 |

## 遗留事项（非阻断）

### 建议尽快修（改动都很小）

1. ~~`lib/llm/jev.ts:132`：`response.json()` 在错误归一化 try 之外~~ **已修（2026-09-21）**：挪进 try，200 但响应体非法 JSON → `invalid_response`（502 归一化）。
2. ~~`app/features/extraction/api/route.ts:65-69`：附件解析失败回显 `parsed.error` 原文~~ **已修（2026-09-21）**：REST 与 MCP 两侧都改为固定可读文案 + 服务端日志，不再透传解析器原文。
3. `README.md:98`「dry_run / 匿名预览不写库、重跑才有完整体」与提交自检口径（:165 匿名重跑不累积）冲突 → 改成"写模式分批续跑才累积"。**已修（2026-09-21 文档一致性清理）**
4. `README.md:80` 导出表：`submission` 导出只支持 json，表内补一句，避免评委传 md/txt 撞 400。**已修**
5. `SHARED_INTERFACES.md` mail 节缺 `POST /features/mail/api/supabase-projects/deactivate`（路由已存在，是切换项目失败后的唯一退路）。**已修**
6. `docs/PHASE2_SPEC.md:20` / `docs/MERGE_NOTES.md:46,55` 旧「服务端注入 token」措辞 → 与 SHARED_INTERFACES 统一为"仅在服务端校验口令后注入；禁止匿名可触发的自动注入转发"。**已修**
7. `lib/shared/config-store.ts` 默认值展示仍含 claude（运行时默认已是 gemini）→ 展示对齐。**已修（同时同步 PHASE2_SPEC 默认值表）**

### 已接受 / 决赛再动

- 在途块最坏时长约 80s 可超 maxDuration 60（已文档化；可收紧单调用超时彻底消除）。
- 匿名 `dry_run` 每次仍读取全部 520 封 JSON（约 0.2–1s；可优化为按 id 读取）。
- 存储层错误消息经只读接口可见（含库内结构信息、非密钥）。
- compare 接口无速率限制（匿名可触发付费调用）；SSRF 面仅 admin（决赛项）。
- 导出分母依赖 inbox 目录完整性（目录被部分拷贝且非空时会漏报完整；可加 520 下限校验）。
- `verification_results.updated_at` 刷新机制以线上控制台 DDL 为准。
- **实现与方案偏差登记**：分块粒度实际为"每波次一块 + 每 20 行落库"（原方案 `BATCH_CHUNK_SIZE=10` 未落地，性能更好）；原验证清单第 16 条按此失效。

### 需要人工操作

- **队友A**：按 `UI_HANDOFF.md` 修 7 处 `/features/verification` 404 等（演示最大风险）。
- **操作者**：Supabase 控制台执行 `scripts/phase2-rls.sql` + anon 权限探测（README「数据库初始化」）。
- **操作者**：本地如需显式 Gemini，填 `GOOGLE_GENERATIVE_AI_API_KEY`（Vercel 已配）。

## 本轮审计产出（截至记录时未提交）

- 新增 8：`UI_HANDOFF.md`、`lib/llm/errors.ts`、`lib/shared/request-errors.ts`、`lib/shared/write-policy.ts`、`lib/shared/versions.ts`、`scripts/crypto-self-test.mjs`、`scripts/check-mcp-annotations.ts`、`scripts/phase2-rls.sql`
- 修改 42（安全收紧 / 健壮性 / 文档同步），未碰任何 UI 文件。

---

## Workshop 2 纪要：Averis 题目答疑专场（2026-09-21 线上 workshop）

来源：官方 workshop 录音转录文本（会议 `meeting-063e802f-5cb3-404a-a51c-28f9d903bd8e`，录音名 `Meeting 21_09_26_19_07_29`，约48分钟）。本节是整理后的重点摘要，不是逐字稿；原始转录含大量语音识别错误和中英混杂，已按上下文修正，拿不准的地方如实标注，没有脑补。

---

### 0. 语音识别修正对照

| 转录原文 | 应为 | 说明 |
|---|---|---|
| Everest / Everts / Avis | **Averis** | 主办方，与开幕式纪要同一处识别错误 |
| shipping dogs / shooting document / saving dogs | **shipping docs / shipping documentation** | 题目"航运单证"，转录 consistently 听错 |
| Ruby（"emphasis on the Ruby"） | **rubric（评分标准）** | 结合上下文"按 rubric 打分" |
| GraphBL checks | **draft BL checks**（疑似） | 问"一周做多少次 BL 核对"，原话听不清，按上下文推断 |
| strike truck（"create the strike truck"） | **听不清，疑似指"标出差异并回传"的动作** | 转录 [09:41] 处，原意是"打印出来标出哪几处要改再扫回去"，具体词无法还原，不影响理解 |
| consigner / consign-y / to-dog | **consignee / to the order of** | 提单字段，转录把术语拆碎了 |
| CSP（"get a CSP"） | **CSV（疑似）** | 上下文在问"导出 CSV"，按此理解 |
| human ejection / human AFC | **human in the loop / 人工介入**（疑似） | 在问"核心靠代码、AI 只做辅助行不行"，见第2节 |
| One-Wight-Taking | **听不清** | [16:43] 处回答"人工核对要几分钟"时的时间表述，已按前后文取"比对本身约10分钟"为准 |

---

### 1. 概况

- 时间：2026-09-21 晚（距 9/22 12:00pm 提交截止约 17 小时），Averis 主讲（Yen 讲业务细节 + 主持人答规则）。
- 形式：纯 Q&A，无 slides，只有录播。问题都围绕"题目到底要做到什么程度、demo 怎么评"。
- 核心一句话：**决赛看同一批数据，准确率重要但不只看准确率；架构和讲故事才是拉开差距的地方**（[01:05][29:23][36:12] 三处反复强调）。

---

### 2. 评分立场重申（最重要的一节，先看这节）

1. **准确率不是唯一判据**：原话"we will not judge solely based on the dataset"，关注点是 architecture / system design。ground truth 已经给了，就是帮大家理解数据该怎么走，不用为数据集过度焦虑（[01:14][01:30]）。
2. **决赛仍用同一批数据判**（"final judge on the same dataset"），目前**没有隐藏的第二批测试集**；如果以后有，会再公告，有的话才会考泛化（[29:21][29:32]）。
3. **纯代码解法可以交，但 AI 占比低会扣分**：有人问"核心靠代码解决、AI 只做辅助行不行"，官方答可以，但"marks will be lower"，最终看 justification 和 system design choice（[05:55][06:04]）。
4. **贵模型 vs 便宜模型、agent vs workflow vs 简单 API**，全部"up to your justification"：Yen 举例"不用 AI、70% 准确率但成本最低也 fine"，另一队用 agent 也行，评委只看"你为什么选这个、技术决策合不合理、是不是为了追潮流（FOMO）而做"（[32:21][36:12][37:46]）。Technology integration 是占比最大的那块分。
5. **合成数据（synthetic / mock）**：可以拿来自己练模型、再到 ground truth 上验证效果，但最终还是用 ground truth 那套判（[42:07][42:31]）。

---

### 3. 提交与演示要求

- **必须有一个 live demo**（[00:29]），demo 里要讲清楚"这个项目是什么、为什么比别人的方案好"。因为人人都有 docker zip 数据，准确率拉不开差距，靠讲解决定的 standout（[00:36][00:47]）。
- **要的是 working prototype，不是 mock 数据**：原话"prototyping is fine, but we do not want a mock data, we want functional ones"，要达到能部署、符合行业标准的程度（[02:24][02:45]）。
- **预计算结果可以**（提前跑好的 safe results fine），但 demo 时必须能现场扔数据进去并正确 flag 出问题（[11:38][11:54]）。
- **有人审（human review）流程必须在视频里 live 演示出来**，有就要展示（[13:24]）。
- **Slide 用 HTML 文件可以**（[05:35]），没有页数限制。
- **JSON 导出**：只要可读、能让评审验证的完整 JSON 就行；它**不需要通过网站提交**——提交网站只收 video / live demo / slides 这几样（[20:11][24:37][25:00]）。
- **CSV 导出是真实现场要的东西**：Yen 确认真实场景要导出 CSV，列出 SI 里是什么、BL 里是什么、为什么判 mismatch（[27:15][27:28]）；结构跟 submission 对齐即可（[28:54]）。
- **输出物要先定方向再做**：每个 UI 功能都要对用户有意义，不要堆功能；summary data 要能说清"给谁看、干嘛用"（[25:43][26:06]）。
- **证据放哪里**：test results 之类都算 validated assumptions；可以放 demo 里（比如 AI 的 confidence、人工点了 approve）、slides 附录、GitHub，三处要一致，不能这边有那边没有（[33:27][33:46]）。用户反馈/测试算在 practical value 里，不会同一份证据算两次分（[35:10]）。
- 评分 rubric、两份数据集 zip 都在 Discord `#resources` 频道（[43:13][46:43]）；决赛路演不对观众开放（[43:04]）。

---

### 4. 数据怎么喂进去（ingestion，官方三种都认）

- Mail server 对接可以（[06:40]）；REST API 发请求可以（[20:47] kérdés 里队伍自述的方案，主办方没反对）；live simulated inbox feed 也可以。
- Averis 自己现状（背景，非要求）：用邮件服务商 + 共享邮箱 + RPA，但不是全量监控收件箱（[21:46]）。
- Demo 重点（Yen 原话）：**从 inbox 开始，到 comparison 出结果、到人审动作，整条链都要能走通**；核心是"证明 discrepancies 能抓出来 + 讲清楚哪一步需要人看、人要做什么动作"（[22:29][23:10]）。
- **必须能上传别的文件集来处理**（评委要换文件测），这可以是一个 feature（[32:02]）。
- 想拿高分就**按场景（case by case）讲**：定两三个目标场景，说明每个场景怎么测、网站怎么覆盖，比泛泛地说"什么都能做"更具体、更可能高分（[07:33][07:49]）。

---

### 5. 业务细节补充（Averis 业务人员 Yen 讲的，可直接拿去写 slide"问题理解"）

- **日常流程**：货代在系统里生成 SI → 发邮件给承运人（carrier）→ 承运人出 BL 草稿 → 航运团队逐封逐项人眼核对 → 打印标出要改的字段 → 扫描发回客户 + 发 amendment 清单（[08:50][09:01]）。
- **三大痛点**（[10:10][10:27][10:49]）：① 邮件太多，找"哪封是 BL、它配哪份 SI"很耗时；② 人工逐项比对耗时且易错；③ 不同承运人的 BL 版式/叫法不一样（比如 POL / load port 混用），人理解得费劲。
- **耗时**：只算"比对"本身约 10 分钟一票，不含找邮件的时间；整单全流程更久（[15:44][16:13][16:26]）。如果系统误报（false alarm），不会直发承运人，专员会先看一眼再定（同段问答的第二问）。
- **错单率**：hachathon 数据约 1/5（46/220）要改，真实周工作量约 20–30 票量级；全对就直接 confirm，不用发 amendment（[03:22][03:56][04:47]）。转录这段很碎，数字只记量级，别当精确 KPI 写。
- **7 个字段哪个错了最麻烦**：Yen 说极少"整段全错"，大多是 partial（空格、换行、星号 `*`/`**` 跨页续行符没对上，其实是同一家）；shipper / consignee / notify party 的星号续行是重灾区；gross weight / container count 一旦错，下游返工明显（[18:09][18:30][19:38]）。
- **consignee vs `to the order of` 是两回事**（[44:00][44:24]）：consignee = 指定收货、承运人实际交货的对象；`to the order of` = 提单可转让（negotiable）的标记，写的是"凭指示交货"的抬头、可背书转让。写 slide 时别把两者混为一谈。
- **"draft BL 发来尽快核对"这类 91 封邮件算哪类**：要看附件——真带了 SI/BL 对、能进下一步比对的，就按 BL 核对链处理；只看正文一句话定不了类（[12:05][12:36]）。
- **漏报 vs 误报哪个代价大（5 倍还是 50 倍）、改单费/银行不符点费/LC 延迟几天、一季度几单**：官方明确说**不在本题范围内**，不用解到提单签发之后的事；发出 amendment 等对方改完即可，费用他们自己不统计（[13:52][15:10][17:06]）。slide 里别给这些编数字。
- **Dashboard 经理看什么**：accuracy + 共抓出多少 discrepancies + 有没有缺字段（用户投诉最多的是"导出的 CSV 缺了我们要的字段"）；他们内部也会拿 manual vs AI 对一遍，看谁漏了（[38:37][39:22][40:04]）。
- **1000 封/天、几个 admin 并发**：官方没给准数，只说现在就是一个几人的小团队在做（[40:34]）。别按这个去过度设计并发，按现有"有上限并发 + 失败隔离"那套即可。

---

### 6. 对我们项目的直接影响 / 提交前待办（对照现状，2026-09-21 晚盘点）

**已经对上的（不用再动，slide 里直接写）**

1. "架构优先"正好是我们现在的路线：规则优先 + Jev 判断 + LLM 兜底（DECISION_LOG 决策22），judge 问"为什么这么选"时有据可查，不是 FOMO 加 AI。
2. AI 是核心链路（分类/抽取/比对里都有模型判定点，见 DECISION_SPEC §6），不是"纯代码 + AI 备份"，避开了第2节第3条的扣分项。
3. "现场扔数据进去能 flag"已覆盖：`POST /features/pipeline/api`（`dry_run` 可预览）+ sandbox 单条即测（评委自带 SI/BL 不写库）+ import 上传别的文件集，三条都是"换文件测"的入口。
4. "预计算结果 fine"：库里已有 520 条结果，demo 即使现场 LLM 额度出问题，也有规则路径保底 + degraded 标记 + 一键重试（决策25）。
5. 导出：`scope=submission` 的 JSON 与官方 schema 对齐（含 fail-closed 校验，决策27）；conflicts / stats 导出有 json/md/txt 可读版本，对应"给 staff 看的 summary"。

**提交前还差的（按优先级排，只剩今晚+明早）**

1. **视频必须出现 human review 的 live 操作**（第3节）：后端 4 模块复核接口已落地，但 GUI 归队友A（见 REVIEW_SPEC / UI_GUIDE）。如果 GUI 来不及，视频里至少用 REST/MCP 现场点一次 confirm/correct/undo，不要只口头说"我们有人审"。
2. **CSV 导出**：Yen 点名真实场景要 CSV（SI 值 / BL 值 / 为什么 mismatch 三列）。我们导出现在是 json/md/txt，没有 `.csv`。时间够就加一个最小 CSV（conflicts 口径复用即可）；不够就别硬加，视频里明说"md/txt 是给人看的可读版，json 是对齐 submission 的机器版"，也算 justification。
3. **Demo 讲两个具体场景，不要讲"全能"**（第4节）：建议就讲 ① inbox→comparison→人审整链 ② 评委现场换一份 SI/BL（走 sandbox）当场出比对 + 导出 CSV/JSON。网站/视频/slide 三处用同一套说法和数字。
4. **Slide"问题理解"页直接用第5节素材**：日常流程 + 三大痛点 + 10 分钟/票 + 1/5 改单率 + 星号 partial mismatch + consignee vs `to the order of` 的区别，评委一听就知道懂行。别写 amendment 费、LC 延迟天数（官方说超范围，写了反而露怯）。
5. **证据三处一致**：demo 里露一次 confidence（如 Jev 0.52/0.88 分界、0.85 阈值），slides 附录贴全量评测数（分类 100%、520/520、缺陷 72/0/0），GitHub 留评测脚本，数字要对得上。
6. **本地 LM Studio、1000 封/天并发**这类问题如果评委问：标准答就是 AGENTS.md 里那套（云端 demo 用不了本地模型是架构限制；批量用有上限并发 + 单条失败隔离），不要现场"修"。
