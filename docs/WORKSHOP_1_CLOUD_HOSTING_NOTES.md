# Workshop 1 纪要：云托管与部署实操（2026-09-20 线上 workshop）

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
3. **仓库可见性**：确认 GitHub 仓库对评委可见（演示里要求 public；当前可见性需核实）
4. **提交人**：Google Form 全队只需一人提交——提前定好谁交，交之前逐项核对必交材料（5 分钟内视频、可公开访问的 demo 链接、GitHub 仓库、slides/文档）
5. **去听 Workshop 2（9/21 晚 7 点）**：Averis 亲讲 + 题目 Q&A，没 slides 只有录播，别错过提问机会
6. 本地 LM Studio 只在本机 / 本地部署模式可用，这是架构限制不是 bug；线上 demo 用云端 provider（已在 AGENTS.md 说明）
7. 遇到部署报错不要慌：Vercel 会列出完整错误清单；且构建失败时线上旧版本仍可访问，不会"整站打不开"
