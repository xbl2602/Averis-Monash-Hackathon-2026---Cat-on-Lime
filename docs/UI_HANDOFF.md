# UI 待办交接（后端 → 队友A）

> 2026-09-20 由后端（council 实现轮）整理。**本文件只列 UI 侧改动，后端这一轮没有碰任何 UI 文件。**
> 动手前先跟操作者确认，从最新 `main` 拉分支再改（见 MERGE_NOTES.md 的 Git 约定）。
> 标注约定：**[必做]** = 初赛提交前要做（多数是评委可见问题）；**[参考]** = 体验/健壮性建议，时间不够可延后。

## 0. 背景与边界

- 后端接口/契约已就绪（见 `SHARED_INTERFACES.md` 的 pipeline / results / config / mail / import 章节），本文件列的是**界面**要做的改动。
- 分工：`app/features/*/ui/**`、`app/_components/**`、`app/dashboard/**`、`app/login/**`、`app/signup/**`、`app/page.tsx`、`app/core/nav.tsx`、`app/layout.tsx`、`app/globals.css` 都归队友A；`logic/api/mcp`、`/app/core/mcp-server`、`/lib` 归操作者。
- 读接口全部开放；写接口需要口令。公开页面**默认只做 dry_run 预览**（见 §4）——这是产品/安全要求，不是可选项。

## 1. 死链修复（最高优先）— [必做]

7 处链接指向 `/features/verification`，现在点开是 **404**：

- `app/core/nav.tsx:7`、`app/page.tsx:234`、`app/page.tsx:354`
- `app/dashboard/_components/topbar.tsx:46`、`sidebar.tsx:14`
- `app/dashboard/page.tsx:11`、`app/dashboard/page.tsx:75`

**期望**：新建 `app/features/verification/page.tsx`（+ `ui/`），最小功能 = limit / provider（默认 gemini）/ dry_run 开关
→ `POST /features/pipeline/api` → 展示 `RunBatchSummary`。

- **命名说明 [必做]**：`/features/verification` 页 = pipeline 的展示壳（同 jev-lab 之于 classification）；业务逻辑不在 `app/core`，页面只调接口。
- **注意**：公开入口默认 `dry_run=true`（见 §4）。

## 2. 三处"占位实现"文案 — [必做]

三页文案写着"占位实现"，与本页实际引擎自相矛盾。只改文案、保留按钮：

- `classification/ui/index.tsx:34-37` → 建议："当前引擎：规则优先，拿不准交给 Jev，必要时 Gemini 文本兜底；样例评测 520/520"
- `extraction/ui/index.tsx:37-40` → 建议："当前引擎：标签规则优先，缺字段才 LLM 兜底；支持 txt/pdf/docx/xlsx"
- `comparison/ui/index.tsx:36-39` → 建议："当前引擎：规范化精确比对 + 文字差异交 Jev 复核（数字不进模型）；拿不准标 NEEDS_REVIEW"

## 3. 结果 / 冲突 / 导出出口（产品第④条要能在网页演示）— [必做]

- 跑批后显示 NEEDS_REVIEW 计数与冲突列表入口：`GET /features/results/api/conflicts`
- 导出按钮：`GET /features/results/api/export?scope=submission&format=json`
- **导出完整性头要 `fetch + blob` 才能读**；`<a>` 直接下载读不到 `X-Export-*`（判断"是否完整"前先读头）
- **[参考]** 结果列表页：`GET /features/results/api`（支持 `category/status/processing/q` + 分页）

## 4. 写保护与 token 约定（重要）— [必做]

- 读接口 + 匿名 `dry_run` 全开放；**公开页面默认 `dry_run=true`**（`wrote` 恒为 0）——验证页 / 任何公开入口不得默认调用写模式
- 写模式（`dry_run=false`）二选一：
  1. 不做 UI 入口（推荐）；或
  2. 要求操作者手动输入口令，经 Server Action / Route Handler 放进 `x-admin-token` 请求头
- **【禁止】创建"公网可触发、服务端自动注入 `process.env.ADMIN_TOKEN` 并转发写请求"的路由 / 代理 / Server Action**——那等于匿名可写库
- token 不落 `localStorage`、不回显；匿名 `dry_run` 单次封顶 **20 封**（`selected ≤ 20`，`remaining` 显示清单剩余规模）
- 验收：无口令访客触发写路径 → 401/403 且结果表 `wrote=0`（页面若不做写入口，以 REST 验证 + 页面请求 payload 恒 `dry_run=true` 为准）

## 5. 验收建议（点击路径 + 硬性项）

- 死链：首页主 CTA → `/features/verification` 200，不再 404
- 匿名 dry_run 预览成功（默认 `dry_run=true`）；三页文案无"占位实现"；conflicts 计数与导出文件可打开
- **【移动端·硬性】** 375px 窄屏（DevTools 375×812 / 真机浏览器）走 首页 → verification → dry_run → `RunBatchSummary`：
  无横向溢出、表格 / JSON 可读（Tailwind 断点 + 滚动容器 / 换行）
- **【写保护】** 页面无"匿名可点、自动带 token 写库"入口；不输口令触发写路径 → 401/403 且 `wrote=0`
- **错误态展示**：401/403（口令错 / 未配置）、503（缺 key）、匿名被截到 20 的提示（如"匿名预览最多 20 封，本次 selected=x / remaining=y"）
- **`email_ids` 选择**：可指定"跑哪几封"（输入或复选；不传 = 前 20 封预览）
- 导出完整性：`fetch + blob` 读 `X-Export-Items` / `Incomplete` / `Expected-Source` 后再展示"是否完整"
- 演示口径：不要说"系统有登录 / 权限"——实际是"读全开放 + 写口令保护"
- 本地生产跑法：`npm run build && npm start`（README 已补）
- 彩排路径：首页 → dashboard → verification → dry_run → conflicts → 下载 submission.json

### remaining 的两种成因（展示文案建议）— [必做]

`remaining > 0` 有两种不同原因，UI 不要混着解释：

1. **匿名预览封顶**（`dry_run=true` 且未带口令）：每次只看清单头部固定前缀（≤20 封），**没有游标**——`remaining = 清单规模 − 本次处理数`，重跑不会推进；想继续看请刷新（还是前 20 封）或到页面上提示"匿名预览最多 20 封"。
2. **deadline 截断 / limit 截断**（写模式或带口令 `dry_run`）：`stopped_by_deadline=true` 表示这一轮被 30s deadline 打断，**再调一次即可续跑**（写模式自动跳过已算好的），`remaining` 会递减；`stopped_by_deadline=false && remaining>0` 通常是 `limit` 到了，调大 limit 或再调一次。

## 6. 已知风险（不在本轮后端改动范围）— [参考]

- `app/dashboard/page.tsx:2,54` 直读并解析全部样例邮件（`listSampleEmails()`）且没有 try/catch：样例数据缺失/损坏时该页可能 500。建议加兜底文案（"数据暂时读取失败"）而不是整页崩掉。
- 首页 `page.tsx:266` 的"≤5 并发批量上限"与后端实际上限（`BATCH_MAX_CONCURRENCY = 8`）不一致，顺手校准即可。
- 页面 provider 下拉的默认值建议 `gemini`（demo 兜底）；`lmstudio` 在云端不可用，可按环境隐藏或给出可读提示。

## 7. 本轮后端新增（2026-09-21，已实现，GUI 可直接接）

> 背景：P0-2/P0-3/P0-4/P1-5/P1-6/P1-7 后端完成（详见 DECISION_LOG 决策 25~29）。
> 接口只增不改：老参数/老响应字段保持不变，新字段可以忽略不显示。

### 7.1 一键重试（失败/降级邮件）

- 触发：`POST /features/pipeline/api`，body `{ "retry_failed": true }`（写模式，需口令；不能和 `email_ids` 同用）
- 语义：服务端自动挑出结果表里 `processing_status='failed'` 或 `model_provider` 含 `degraded` 的邮件，强制重算；没有目标时 `ran=0` 正常返回
- 建议：结果页统计区显示"处理失败 N 封、降级 M 封"，加一个按钮调用；调用后展示 `RunBatchSummary`（ran / succeeded / failed / remaining）
- 筛选列表：`GET /features/results/api?processing=failed`（失败）；`GET /features/results/api?provider=degraded`（降级，子串匹配）

### 7.2 冲突数值搜索（精确/模糊 + 按值）

- `GET /features/results/api/conflicts` 新增：`numeric_mode=exact|fuzzy`、`tolerance`（仅 fuzzy，≥0）、`value_field=container_count|gross_weight_kg`、`value`（必须成对）
- 示例：`?numeric_mode=fuzzy&tolerance=2`（差值 ≤2kg 不算冲突）；`?value_field=gross_weight_kg&value=12000&numeric_mode=fuzzy`（≈12000）
- 建议文案："数值口径：精确 / 模糊（容差 __）" + "按值搜索：字段 + 数值"
- 只影响查询，不影响导出提交（submission 永远是精确判定的结果）

### 7.3 字段级出处（证据）

- `list_results` items 新增 `evidence_si` / `evidence_bl`；`list_conflicts` items 新增 `si_evidence` / `bl_evidence`
- 形状：`{ [字段名]: { line: 3, text: "Shipper: ABC PTE LTD", source: "rules" } }`；LLM 兜底字段只有 `{ source: "llm" }`（没有行号，不要显示"第 N 行"）
- 建议：冲突卡片/字段详情显示"出处：第 3 行 · 原文片段"（折叠区或 `title` 提示）

### 7.4 导出完整性新响应头

- `X-Export-Invalid` / `X-Export-Invalid-Ids`：行内自相矛盾（如 MISMATCH 没有缺陷清单、NEEDS_REVIEW 缺原因）的 email_id；任一条时 `X-Export-Incomplete` 也为 true
- 建议：`fetch + blob` 下载 submission 后检查头，`Invalid > 0` 显示红色告警（"提交文件有 N 条自相矛盾，请先修复/重跑"）；`Missing` / `Stale` 沿用原建议

## 8. 落地页滚动叙事（2026-09-21，已实现，规格见 docs/LANDING_REDESIGN_PROMPT.md）

首页 `/` 现在是"一张纸折成纸飞机、沿航线飞过 5 个场景"的滚动驱动页面（GSAP + Lenis + SVG，无 WebGL）。**只涉及前端文件**：`app/page.tsx`、`app/_components/scroll/`、`app/_components/landing/`、`app/globals.css`、`app/_components/marketing-nav.tsx`，没有碰任何 `logic/api/mcp`。

- **演示保险开关（写进彩排手册）**：投影/演示机卡顿时，地址后加 `?motion=off`（如 `/?motion=off`）→ 变成普通竖排页面，内容一样、没有飞机和动画。系统开了"减少动态效果"、窄屏（<768px）也会自动走降级版本（窄屏保留右下角小飞机）。
- **调飞行路线**：`/?debug=path` 会把飞机航线画成粉色虚线；航点在 `app/_components/scroll/flight-waypoints.ts`（视口比例坐标）。
- **调场景时长**：`app/_components/scroll/scene-config.ts`（单位 vh，页面 CSS 高度和飞机时间线都读这一份，改一处即可）。
- **主题**：滚动时页面 亮 → 黄昏 → 暗 → 亮，只在"访客没手动选过主题且系统是亮色"时生效；点右上角开关或系统是暗色，就整页固定该主题（手动选择永远优先）。
- **文案**：所有落地页文案集中在 `app/_components/landing/content.ts`，场景只决定摆在哪，不改字。
- **页面高度依赖 vh**：`.scene` 的高度 = (pin + 100)vh，改 `pin` 数值要和 `scene-config.ts` 同步（场景组件已直接读它）。
