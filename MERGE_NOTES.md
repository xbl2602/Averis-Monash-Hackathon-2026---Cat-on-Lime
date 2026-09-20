# 合并记录（2026-09-20）

这份文件记录 2026-09-20 把队友A的前端分支合并进 `main` 时做了什么、为什么这么做、以及接下来要注意什么。
不用记住全部，只要出问题时知道"回来翻这份文件"就够了。

## 合并了什么

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

- [ ] 确定 `/features/verification` 页面由谁做：决定后把结论写到 SHARED_INTERFACES.md 或这里
- [ ] 做 `/features/verification` 页面（接 `POST /features/pipeline/api`；需求方输入：跑哪几封、最多几封、用哪个 provider、要不要 dry_run；展示：本次成功/失败/剩余多少封）
- [ ] 给 Claude / OpenAI / DeepSeek 申请 API key 并填到 Vercel（环境变量写 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`，见 .env.example）
- [ ] 顺手看一眼控制台统计数字：合并后在 `/dashboard` 确认"已配置 LLM"数量显示合理（云端应显示 Jev + Gemini 等已配的）
