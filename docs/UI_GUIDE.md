# GUI 开发指南（接口速查 + 界面改动清单）

> 用途：给做界面的人看的**唯一一份 GUI 文档**。合并了原 `API_READY_FOR_GUI.md`（第一部分：就绪接口速查）与 `UI_HANDOFF.md`（第二部分：要做的界面改动与验收）。
> 接口契约永远以 [SHARED_INTERFACES.md](SHARED_INTERFACES.md) 为准；本文件只写状态、口令与改动，不复制字段级契约。
> 最后核对：2026-09-21。

---

## GUI 接口速查（就绪清单）

> 给做界面的人用的一页纸：**哪些接口现在就能接、哪些要口令、哪些是占位别接、去哪儿看详细契约**。
> 最后核对：2026-09-21（逐个 `app/**/route.ts` 与文档核对）。

## 这份文档的边界（防止文档越写越乱）

- **本页不是契约。** 路径/参数/返回/错误的权威说明永远是 [`SHARED_INTERFACES.md`](SHARED_INTERFACES.md)。
- 本页只回答三件事：**能不能用、要不要口令、去哪查**；**不复制字段清单**（复制就会出现两处不一致）。
- 维护规则：改接口的人（操作者）在改 `api/` 的同一次提交里更新本页；只改"状态 / 链接 / 一句话作用"。
- 本页已在 [README.md](../README.md) 登记，是 GUI 对接的**唯一入口**；其它文档只作为深入阅读。

## 0. 30 秒结论

- **读接口全部开放**，不需要口令（结果查询、统计、冲突、导出、配置读、文档池读、Gmail 状态读）。
- **写接口需要 `x-admin-token`**（配置写、上传、人工归类、多 Supabase 管理、Gmail 断开、跑批写模式）。
- 公开页面**默认只能 `dry_run=true` 预览**（一次最多 20 封，不写库）——这是产品/安全要求。
- 唯一"看着像功能、其实是占位"的是 **Gmail 自动收发**（`connect` / `sync_gmail` 返回 `not_implemented`）。
- **多 Supabase 项目切换是真实现**，可以放心接。

## 1. 文档去哪找

| 你想知道 | 看哪 |
|---|---|
| 接口契约（路径 / 参数 / 返回 / 错误码） | [`SHARED_INTERFACES.md`](SHARED_INTERFACES.md) |
| 界面要做的改动 + 验收标准（含移动端） | 本文件第二部分（标题「UI 待办交接」，在下方） |
| config / mail / import 三块的产品与安全设计 | [`PHASE2_SPEC.md`](PHASE2_SPEC.md) |
| 队友A分支合并后后端新增了什么 | [`HISTORY.md`](HISTORY.md) |
| 数据在模块之间怎么流动（硬规则） | [`DATA_FLOW.md`](DATA_FLOW.md) |
| 为什么这么定（决策记录） | [`DECISION_LOG.md`](DECISION_LOG.md)、[`DECISION_SPEC.md`](DECISION_SPEC.md) |
| 决赛计划与缺口 | [`FINALS_ROADMAP.md`](FINALS_ROADMAP.md) |
| 会议纪要 / 审计记录（历史，不用改） | [`HISTORY.md`](HISTORY.md) |

## 2. 按页面分组：现在能接的接口

图例：**口令** = 请求头需要 `x-admin-token`；**状态** = `实做`（真能用）/ `占位`（别接）/ `仅说明`（浏览器打开只回用法，正常现象）。

### 2.1 核验页 `/features/verification`（跑批）

| 方法 路径 | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `POST /features/pipeline/api` | 整箱批量核验（分类→抽取→比对→写结果） | `dry_run=true` 免口令（封顶 20 封）；写模式需 | 实做 |
| `GET /features/pipeline/api` | 浏览器打开时回用法说明 | 免 | 仅说明 |

常用请求字段：`email_ids` / `limit` / `force` / `dry_run` / `provider` / `concurrency` / `retry_failed`；返回 `RunBatchSummary`（ran / succeeded / failed / remaining 等）。

### 2.2 结果 / 冲突 / 导出

| 方法 路径 | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `GET /features/results/api` | 结果列表（筛选/排序/分组/分页） | 免 | 实做 |
| `GET /features/results/api/stats` | 统计汇总 | 免 | 实做 |
| `GET /features/results/api/conflicts` | 冲突文件对（支持数值精确/模糊、按值搜） | 免 | 实做 |
| `GET /features/results/api/export` | 导出 results / conflicts / stats / submission | 免 | 实做 |

注意：导出文件带完整性响应头（`X-Export-*`），要用 `fetch + blob` 才能读到，`<a>` 直接下载读不到（见本文件第二部分 §3/§7.4）。

### 2.3 分类 / 抽取 / 比对（演示页或 jev-lab）

| 方法 路径 | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `POST /features/classification/api` | 单封邮件分类（规则→Jev→文本模型链） | 免 | 实做 |
| `POST /features/extraction/api` | SI/BL 附件抽 7 字段（规则优先，缺字段 LLM 兜底） | 免 | 实做 |
| `POST /features/comparison/api` | 比对 SI 与 BL，标差异与 NEEDS_REVIEW | 免 | 实做 |
| 以上三个的 `GET` | 浏览器打开时回用法说明 | 免 | 仅说明 |

`provider` 可选值以 `lib/llm` 导出的 `LLM_PROVIDERS` 为准（前端下拉框直接用，不要自己另写一份清单）。

### 2.4 配置页

| 方法 路径 | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `GET /features/config/api` | 读运行时配置（敏感值只回掩码） | 免 | 实做 |
| `PUT /features/config/api` | 批量写配置（带乐观锁，过期 409） | 需 | 实做 |
| `POST /features/config/api/test` | 测试某个连接（LLM / Supabase 等） | 需 | 实做 |

注意：只有"测试连接"和配置 CRUD 会立刻生效；`provider_priority`、阈值、`pipeline.*`、`storage.*` 目前仍是**展示项**，改了不改变运行时行为（README 已注明）。

### 2.5 设置页：Gmail + 多 Supabase

| 方法 路径 | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `GET /features/mail/api/gmail` | 查 Gmail 连接状态（不回 token） | 免 | 实做 |
| `POST /features/mail/api/gmail/connect` | 返回"未实现 + 怎么接 + 回调地址" | 需 | **占位** |
| `POST /features/mail/api/gmail/disconnect` | 清 token、置为未连接 | 需 | 实做 |
| `GET /features/mail/api/supabase-projects` | 列出已配置的 Supabase 项目（key 只回掩码） | 免 | 实做 |
| `POST /features/mail/api/supabase-projects` | 新增 / 更新项目 | 需 | 实做 |
| `POST /features/mail/api/supabase-projects/activate` | 切换当前启用的项目 | 需 | 实做 |
| `POST /features/mail/api/supabase-projects/deactivate` | 停用当前项目（切换失败后的恢复通道） | 需 | 实做 |

界面上建议如实写明：Gmail 目前是"接口就绪、真实授权未接"。

### 2.6 上传页 / 文档池

| 方法 路径 | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `POST /features/import/api/upload` | 手动上传单证（校验→解析→识别→存 Storage+落库） | 需 | 实做 |
| `GET /features/import/api/upload` | 浏览器打开时回用法说明 | 免 | 仅说明 |
| `GET /features/import/api/documents` | 文档池列表（预览只回 500 字符） | 免 | 实做 |
| `GET /features/import/api/documents/[id]` | 单文档详情（含全文） | 免 | 实做 |
| `PUT /features/import/api/documents` | 人工归类（`UNKNOWN` → 指定类型） | 需 | 实做 |

上传侧约定：文件夹用 `<input webkitdirectory>` 拿列表后**按 3MB/批**切开逐个请求（整批超限返回 413）。

### 2.7 人工复核（新，还没有界面——这是给你的下一块拼图）

后端（REST+MCP）已实现，**GUI 还没人接**，是队友A当前最大的一块待做。完整设计（队列筛选、动作按钮、
时间线、口令、移动端）见 [`REVIEW_SPEC.md`](REVIEW_SPEC.md) 第 9 节；接口契约见
[`SHARED_INTERFACES.md`](SHARED_INTERFACES.md)「人工复核闭环」一节。这里只列一页纸速查：

| 方法 路径（`<m>` = classification/extraction/comparison/pipeline） | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `GET /features/<m>/api/review` | 复核队列（默认异常驱动，`include_ok=true` 看全部） | 免 | 实做 |
| `POST /features/<m>/api/review` | 应用一个动作（confirm/correct/disposition/defer/undefer/note/rerun） | 需 | 实做 |
| `GET /features/<m>/api/review/history?email_id=` | 某条的动作时间线 | 免 | 实做 |
| `POST /features/<m>/api/review/undo` | 撤销最近一次动作 | 需 | 实做 |
| `POST /features/<m>/api/review/bulk` | 批量应用（逐条独立、失败隔离） | 需 | 实做 |

先接 `comparison`（MISMATCH 签字闭环，最核心）；四个模块的动作集一样，UI 组件可以共用（建议放
`app/_components/review/`，REVIEW_SPEC §9 有写）。乐观锁：写操作可选带 `expected_updated_at`，
冲突返回 409，前端应提示"这条已被别人改过"。

### 2.8 Sandbox：评委自带 SI/BL 文档临时测试（新，还没有界面）

| 方法 路径 | 一句话作用 | 口令 | 状态 |
|---|---|---|---|
| `POST /features/sandbox/api` | 拿自己的 SI+BL 文件（不是仓库样例）跑一次分类(可选)+抽取+比对，不写库 | 免 | 实做 |
| `GET /features/sandbox/api` | 浏览器打开时回用法说明 | 免 | 仅说明 |

建议界面：一个表单——邮件主题/正文（可选文本框）+ 两个文件选择框（SI / BL，各自限
`.txt/.md/.pdf/.docx/.xlsx`，单文件 1.5MB）+ 一个 provider 下拉（可选）。提交后把文件转
`data_base64`（`FileReader.readAsDataURL` 去掉前缀，或 `arrayBuffer` 转 base64）塞进请求体；
展示分类结果（没给主题/正文时这块不显示）、SI/BL 各自抽出的 7 个字段、比对结论与差异字段。
这个页面**不需要口令、不需要 Supabase**，可以放在导航里独立一个入口（比如"Try your own"），
也适合放进首页的产品介绍区旁边做一个"现在就试试"的 CTA。

## 3. 口令怎么带（重要）

- 写接口统一请求头 `x-admin-token`；服务端口令存在环境变量 `ADMIN_TOKEN`（未配置 403，口令错 401）。
- **不要在公开页面做"匿名可点、服务端自动注入口令"的入口**——那等于匿名可写库（见本文件第二部分 §4，硬性要求）。
- 要做写入口：由操作者手动输入口令，经 Server Action / Route Handler 放进请求头；口令不落 `localStorage`、不回显。
- 匿名 `dry_run` 单次封顶 20 封。

## 4. 占位 / 别接

- `POST /features/mail/api/gmail/connect`、MCP `sync_gmail`：返回 `not_implemented`，是**有意占位**，不是 bug。
- `GET /features/import/api/documents/export`：`PHASE2_SPEC.md` 提到过，但代码里**不存在**，不要接（见第 6 节）。

## 5. MCP tool（给 AI agent 用，不是 GUI）

共 28 个（2026-09-21 新增人工复核闭环 16 个 + sandbox 1 个之后的准确数），地址与握手见 README「REST API 与 MCP Server」一节。读工具 17 个、写工具 11 个（写工具按 MCP 规范必须显式声明否则一律要口令）。

| 工具 | 读/写 | 状态 |
|---|---|---|
| `classify_email` | 读 | 实做 |
| `extract_document_fields` | 读 | 实做 |
| `compare_documents` | 读 | 实做 |
| `run_batch` | 写（`dry_run=true` 免口令） | 实做 |
| `list_results` / `get_stats` / `list_conflicts` / `export_results` | 读 | 实做 |
| `sync_gmail` | 写（一律需口令） | **占位** |
| `list_uploaded_documents` | 读 | 实做 |
| `classify_uploaded_document` | 写 | 实做 |
| `run_adhoc_test`（sandbox，评委自带 SI/BL 临时测试） | 读（不写库） | 实做 |
| 人工复核闭环，四模块（`<m>` = classification/extraction/comparison/pipeline）各 4 个：`list_<m>_review`（读）/ `get_<m>_review_history`（读）/ `apply_<m>_review_action`（写）/ `undo_<m>_review_action`（写） | 读×2 写×2 每模块，共 16 个 | 实做（详见 §2.7） |

## 6. 已知的文档不一致（2026-09-21 已全部修复，见 TODO.md P2-6）

原来记的 6 条（导出端点不存在、端点表缺三条 POST、MCP 未逐项列工具、缺 `lmstudio`、缺
`supabase-projects/deactivate`、import 参数缺 `detected_type`、口令措辞过粗）已经全部同步进
`PHASE2_SPEC.md` 和 `SHARED_INTERFACES.md`，这里不再重复列。以后再发现新的不一致，照这个格式加进来。


---

## UI 待办交接（后端 → 队友A）

> 2026-09-20 由后端（council 实现轮）整理。**本文件只列 UI 侧改动，后端这一轮没有碰任何 UI 文件。**
> 动手前先跟操作者确认，从最新 `main` 拉分支再改（见 HISTORY.md 的 Git 约定）。
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

## 8. 手绘草图功能核对（2026-09-21，操作者拿两张手绘图对照现状）

> 背景：操作者画了两张图（Main 列表+展开对比、Dashboard），本意是标注"系统要有什么功能"而不是具体界面样式。核对结论：图上的功能点后端已经全部就绪，缺口仍然是"没接 GUI"，和上面 §2.7/§3 是同一个缺口，不是新后端工作。这里只补两条图纸带出来、但前面章节写得还不够具体的点，以及一个待确认的开放问题。

### 8.1 Dashboard 应该是独立页面，不是列表页里的附属项

图上的 Dashboard 是一个单独页面：总处理数 / 失败数、几张 detail 明细卡片、"导出全部结果"按钮。对应接口全部就绪：

- `GET /features/results/api/stats`（`total_emails` / `failed` / `by_category` / `by_status` / `defect_field_frequency`）
- `GET /features/results/api/export?scope=stats` 或 `scope=submission`（导出全部）

之前 §3 只把它列成结果列表页的"[参考]"附属项，图纸的意思是它值得单独做一个页面（首页/导航栏一个入口），不是塞在别的页面角落。

### 8.2 并排对比视图：后端只给到"哪个字段不一致"，不给字符级高亮

图上"compare view 展开"要求两栏并排、差异部分用颜色标出。数据来源：

- 每条记录的 `defect_fields`（字段级——告诉你"consignee 这个字段不一致"）+ `comparison_status`（OK/MISMATCH/NEEDS_REVIEW，对应图上的 normal/warning）
- `evidence_si` / `evidence_bl`（字段级出处，`{ line, text, source }`，可以做"点开看原文第几行"）

**后端不做字符级 diff**（比如 `APRIL Fine Paper` vs `APRIL FIne Paper` 具体哪个字母不一样）——两边的完整字段值都已经在返回里（`extracted_si`/`extracted_bl` 或 conflicts 的 `si_values`/`bl_values`），如果要做到字符级高亮，前端自己拿这两个字符串跑一个 diff 库即可，不需要后端再加接口。

### 8.3 开放问题（未定，先记录不动手）——"和别的邮件比对"按钮的本意

图上 Main 列表里有一个"compare with other mail"触发按钮，指向 compare 展开视图。有两种可能，目前操作者尚未决定是哪种：

1. **看这封邮件自己的 SI vs BL**——数据已经齐全（`extracted_si`/`extracted_bl` 已经在 `list_results`/`list_conflicts` 返回里），纯前端展示，不需要新接口。
2. **任选两封不相关的邮件互相比对**——现有 `POST /features/comparison/api` 理论上能接受任意两组字段（不强制要求同一封邮件），但没有"传两个 `email_id` 直接比"的便捷接口；如果确定要做成正式功能，需要后端补一个小接口（把两个 `email_id` 换成各自的 `extracted_si`/`extracted_bl` 再调 `compareDocumentsHybrid`）。

**在操作者明确是哪种之前，不要按第 2 种去实现 GUI 或加后端接口**，避免做完发现理解错了要返工。

### 8.4 唯一一个真正"接口也没准备好"的点——分类"没把握但没失败"没有落库

图上 Main 页的"Check"标签页，如果本意是"分类置信度不够、需要人工看一眼"（区别于 §2.7 review 闭环里已覆盖的"分类彻底失败降级"），**这个数据现在拿不到**：`classifyEmailHybrid` 算出的置信度/`needs_review` 只在单条实时调用时临时返回一次，批量流水线跑完不会把它存进 `verification_results`，所以列表/统计接口都查不到"哪些邮件分类没把握"。这不是"没接 GUI"，是**数据库这层就没留这一列**，要做的话得先加一列 schema 改动、再改批量流水线写入逻辑——真正需要操作者新写后端代码的点，跟前面几条"接口都在只是没人调"性质不一样。详见 [SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md)「人工复核闭环」一节的"已知缺口"。

## 9. 落地页滚动叙事运维笔记（队友A交付，2026-09-21）

首页 `/` 现在是"一张纸折成纸飞机、沿航线飞过 5 个场景"的滚动驱动页面（GSAP + Lenis + SVG，无 WebGL）。完整设计规格见 [`LANDING_REDESIGN_PROMPT.md`](LANDING_REDESIGN_PROMPT.md)。**只涉及前端文件**：`app/page.tsx`、`app/_components/scroll/`、`app/_components/landing/`、`app/globals.css`、`app/_components/marketing-nav.tsx`，没有碰任何 `logic/api/mcp`。

- **演示保险开关（写进彩排手册）**：投影/演示机卡顿时，地址后加 `?motion=off`（如 `/?motion=off`）→ 变成普通竖排页面，内容一样、没有飞机和动画。系统开了"减少动态效果"、窄屏（<768px）也会自动走降级版本（窄屏保留右下角小飞机）。
- **调飞行路线**：`/?debug=path` 会把飞机航线画成粉色虚线；航点在 `app/_components/scroll/flight-waypoints.ts`（视口比例坐标）。
- **调场景时长**：`app/_components/scroll/scene-config.ts`（单位 vh，页面 CSS 高度和飞机时间线都读这一份，改一处即可）。
- **主题**：滚动时页面 亮 → 黄昏 → 暗 → 亮，只在"访客没手动选过主题且系统是亮色"时生效；点右上角开关或系统是暗色，就整页固定该主题（手动选择永远优先）。
- **文案**：所有落地页文案集中在 `app/_components/landing/content.ts`，场景只决定摆在哪，不改字。
- **页面高度依赖 vh**：`.scene` 的高度 = (pin + 100)vh，改 `pin` 数值要和 `scene-config.ts` 同步（场景组件已直接读它）。
