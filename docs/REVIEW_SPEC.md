# 人工复核（Human-in-the-Loop）设计规范

> 状态：**后端（REST+MCP）已实现**（2026-09-21，四模块都接了）；**GUI 未做**（队友A待办，见第 9 节 / UI_GUIDE.md）。实现与本方案的偏差登记见第 15 节。决策来源见本文第 1 节；接口契约以 [SHARED_INTERFACES.md](SHARED_INTERFACES.md) 为准，本文件是"要做什么、为什么、怎么划分"的权威说明。
> 关联文档：[DATA_FLOW.md](DATA_FLOW.md)（数据流硬规则）、[PHASE2_SPEC.md](PHASE2_SPEC.md)（写保护/口令沿用它）、[UI_GUIDE.md](UI_GUIDE.md)（GUI 状态与待办）、[FINALS_ROADMAP.md](FINALS_ROADMAP.md)（A6 原为搁置项，本规范把它提前到现在做）。

## 0. 背景与目标

题目第④条要求"拿不准时提示需要人工介入"。现状**只做到"提示"**：

- 分类：`needs_review`（置信度 < 0.85，或全模型失败走 `degraded`）
- 比对：`NEEDS_REVIEW` + `review_reason`（`missing_attachment` / `wrong_doc_type` / `unreadable` / `missing_value`）
- 技术失败：`processing_status='failed'`，`model_provider` 含 `degraded`

**缺失的是闭环**：没有任何界面让人处理这些提示，没有"人工结论"落库，也没有"人工结论进入最终提交"的路径（`results` / `pipeline` / `import` 都没有 `ui/`）。

本规范要补齐的闭环：

1. 系统把"能确定的"自动定掉，把"举手的项"放进复核队列；
2. 人**只通过 GUI** 对队列项做处置（确认 / 修正 / 分拣去向 / 搁置 / 重跑）；
3. 处置结果**写回并成为最终答案**（进入 `scope=submission` 导出）；
4. 支持**撤销**、**批量操作**，全程有 append-only 审计。

### 已确认的设计决策

| # | 决策 | 取值 |
|---|---|---|
| D1 | 写入口模型 | 口令解锁 + 服务端会话（httpOnly 签名 cookie，token 不下发浏览器） |
| D2 | 架构 | **按模块入口 + 共用机制**：四模块各有复核入口，底层动作日志/撤销/搁置/审计/覆盖合并共用 `lib/shared/review/` 一份 |
| D3 | 队列范围 | 默认异常驱动（只放 `needs_review` / `MISMATCH` / `failed` / `degraded`），提供"显示已判 OK 项"开关，可抽查或全审 |
| D4 | 动作集 | 确认 confirm、修正 correct、分拣去向 disposition、搁置/恢复 defer/undefer、备注 note、重跑 rerun、撤销 undo、批量 |
| D5 | 覆盖是否进入提交 | 是——人工结论套到 `scope=submission` 导出之上 |
| D6 | 复核对象 | 邮件结果（`verification_results` / `verification_overview`）；上传文档归类保持 `import` 现状不动 |

## 1. 触发点（谁进队列）

| # | 触发点 | 信号 | 人的处置 |
|---|---|---|---|
| 1 | 分类拿不准 | `needs_review=true`（置信度 < 0.85 / `degraded`） | 改判 category、分拣去向 |
| 2 | 附件/文档不对 | `NEEDS_REVIEW` + `missing_attachment` / `wrong_doc_type` | 确认是否要比对、退回、待补件 |
| 3 | 读不出内容 | `NEEDS_REVIEW` + `unreadable` | 标记无法处理 / 待补可读件 |
| 4 | 字段缺失 | `NEEDS_REVIEW` + `missing_value` | 人工补值 / 确认缺失 |
| 5 | 比对有差异 | `MISMATCH` | 放行（误报）/ 确认为真缺陷 |
| 6 | 处理失败/降级 | `processing_status='failed'` / `model_provider` 含 `degraded` | 重跑 / 人工修正 |

注：#5 不是"分类拿不准"，而是**业务签字**——分类抽取都成功，人确认差异是否成立。

## 2. 架构：按模块入口 + 共用机制

```
                    ┌─────────────────────────────────────────────┐
                    │  lib/shared/review/（共用机制，唯一实现）      │
                    │  types / store / actions / merge / rerun      │
                    └───────▲──────────▲──────────▲──────────▲──────┘
                            │          │          │          │
        ┌───────────────────┘          │          │          └──────────────────┐
        │                              │          │                             │
[classification]              [extraction]   [comparison]              [pipeline]
 logic/api/mcp/ui              logic/...      logic/...               logic/... （重跑）
 （分拣去向、重跑分类）        （改字段值）   （放行/退回/改结论）    （failed/degraded 重跑）
```

- **按模块入口**：每个模块在自己的 `logic/api/mcp/ui` 里加复核能力，界面归各自模块，互不引用内部实现。
- **共用机制**：动作日志、撤销、搁置、审计、覆盖合并只有一份，放 `lib/shared/review/`（规范允许的公共区）。
- **禁止**：模块之间互相 import `logic`；界面直接查库或调别的模块（见 [DATA_FLOW.md](DATA_FLOW.md) 规则 1、2）。
- **重跑**：各模块的 rerun 调 `lib/shared/review/rerun.ts`，后者复用 `lib/shared/pipeline.ts` + `lib/shared/sample-inputs.ts` + `lib/shared/verification-store.ts`，不复制引擎顺序逻辑。

## 3. 数据模型

新增迁移脚本 `scripts/review-schema.sql`（幂等，Supabase SQL Editor 执行）。两张表，读对 anon 开放、写只有 service role（与现有表口径一致）。

### 3.1 `review_overrides`（当前生效的人工结论，每项一行）

```sql
create table if not exists review_overrides (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null,          -- classification | extraction | comparison | pipeline
  email_id text not null,
  review_state text not null,         -- confirmed | corrected | deferred
  disposition text,                   -- 见 4.3，可空
  category text,                      -- 人工改判后的分类（可空）
  comparison_status text,             -- 人工改后的比对结论（可空）
  review_reason text,                 -- 人工指定的复核原因（可空）
  defect_fields jsonb,                -- 人工确认的缺陷字段（可空）
  extracted_si jsonb,                 -- 人工修正后的 SI 字段（可空）
  extracted_bl jsonb,                 -- 人工修正后的 BL 字段（可空）
  note text,
  decided_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_kind, email_id)
);
```

- 写入一律 **upsert**，冲突键 `(target_kind, email_id)`；**禁止"先查再插"**（规范硬要求）。
- `updated_at` 由写入方显式设置，用作**乐观锁**：请求带 `expected_updated_at`，不匹配返回 409。

### 3.2 `review_actions`（append-only 审计日志）

```sql
create table if not exists review_actions (
  id bigint generated always as identity primary key,
  target_kind text not null,
  email_id text not null,
  action_type text not null,          -- confirm|correct|disposition|defer|undefer|note|rerun|undo
  before_state jsonb,                 -- 执行前 review_overrides 快照（不存在为 null）
  after_state jsonb,                  -- 执行后快照
  undo_of bigint,                     -- 仅 undo 行：指向被撤销的动作 id
  reason text,
  note text,
  actor text not null default 'admin',
  batch_id uuid,                      -- 批量操作分组
  created_at timestamptz not null default now()
);
create index if not exists review_actions_target_idx
  on review_actions (target_kind, email_id, created_at desc);
```

这张表**只增不改**，撤销也靠追加一条 `undo` 行 + 把快照写回 `review_overrides`。

### 3.3 类型（`lib/shared/review/types.ts`）

```ts
export const REVIEW_TARGET_KINDS = ["classification", "extraction", "comparison", "pipeline"] as const;
export type ReviewTargetKind = (typeof REVIEW_TARGET_KINDS)[number];

export const REVIEW_STATES = ["confirmed", "corrected", "deferred"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_ACTION_TYPES = [
  "confirm", "correct", "disposition", "defer", "undefer", "note", "rerun", "undo",
] as const;
export type ReviewActionType = (typeof REVIEW_ACTION_TYPES)[number];

export const REVIEW_DISPOSITIONS = [
  "accepted",        // 确认无需改动（放行）
  "corrected",       // 已人工修正
  "routed",          // 已分拣去向（去向 = 修正后的 category）
  "returned",        // 退回重跑/重处理
  "awaiting_input",  // 待补件 / 待上游
  "unprocessable",   // 无法处理（转线下）
] as const;
export type ReviewDisposition = (typeof REVIEW_DISPOSITIONS)[number];
```

人工覆盖与动作行的形状：

```ts
export interface ReviewOverride {
  target_kind: ReviewTargetKind;
  email_id: string;
  review_state: ReviewState;
  disposition: ReviewDisposition | null;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[] | null;
  extracted_si: ExtractedDocumentFields | null;
  extracted_bl: ExtractedDocumentFields | null;
  note: string | null;
  decided_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewActionRow {
  id: number;
  target_kind: ReviewTargetKind;
  email_id: string;
  action_type: ReviewActionType;
  before_state: ReviewOverride | null;
  after_state: ReviewOverride | null;
  undo_of: number | null;
  reason: string | null;
  note: string | null;
  actor: string;
  batch_id: string | null;
  created_at: string;
}
```

复核条目对外形状（队列项）：

```ts
export interface ReviewQueueItem {
  email_id: string;
  subject: string;
  // 系统原始结论（来自 verification_overview）
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  processing_status: "ok" | "failed" | "pending";
  model_provider: string | null;
  // 人工覆盖（无则 null）
  override: ReviewOverride | null;
  // 有效结论（系统 + 覆盖合并后的最终值）
  effective: EmailVerificationResult | null;
  last_action_at: string | null;
  updated_at: string | null;
}
```

## 4. 动作语义

### 4.1 确认 confirm / 修正 correct

- `confirm`：同意系统结论，不改值；`review_state=confirmed`，清除该模块此前的 override 决策字段（保留 note）。
- `correct`：人工改判；payload 只带要改的字段（**部分更新**，未带字段沿用系统值）：
  - classification：`category`
  - comparison：`comparison_status` / `review_reason` / `defect_fields`
  - extraction：`extracted_si` / `extracted_bl`
- **一致性归一**：写库前必须过 `normalizeOverride()`，保证"MISMATCH 必有缺陷清单、NEEDS_REVIEW 必有原因且无缺陷、OK 无缺陷无原因"（规则同导出校验）；非法组合返回 400，不写库。

### 4.2 搁置 defer / 恢复 undefer

- `defer`：`review_state=deferred`，可带 `reason`（可读文本）；项留在库里但在默认队列中隐藏。执行前的 override 快照进 `before_state`。
- `undefer`：把 `review_overrides` **还原成 defer 之前的快照**（取 defer 动作的 `before_state`）；若之前没有 override 则删除该行。动作仍留审计。
- 搁置**不改变**有效结论；导出仍用系统结果，但在响应头里如实标记未闭环数量（见 5.2）。

### 4.3 分拣去向 disposition

- `disposition` 是"这条接下来怎么办/去哪"，与 `correct` 可同时发生（先改 category，再定去向）。
- 枚举见 3.3：`accepted`（放行）/ `corrected`（已修正）/ `routed`（已分拣）/ `returned`（退回重跑）/ `awaiting_input`（待补件）/ `unprocessable`（无法处理）。
- **去向目标放在 `category` 字段**：`routed` + `category=BL_COMPARISON` 表示"分拣为 BL 比对流程"，其余分类同理（`SI_REQUEST` / `INVOICE_QUERY` / `GENERAL` / `SPAM`）。不重复造一套路由枚举。
- 主要用于 classification 模块；其余模块用 `accepted` / `corrected` / `returned`。

### 4.4 备注 note

- **只往 `review_actions` 追加一条 `note` 行，不写 `review_overrides`**，因此不改 `review_state`、不改有效结论；用于记录判断依据。
- 备注随时间线展示；撤销备注 = 追加一条 `undo` 指向该 note 行（只影响日志显示，不影响结论）。

### 4.5 重跑 rerun

- 单个 `email_id` + 可选 `provider`，调 `lib/shared/review/rerun.ts`：复用 `runEmailPipeline` 重算并 upsert `verification_results`。
- 重跑成功**不清除**已有 override（人此前可能已修正）；UI 需提示"重跑会刷新系统结论，但你的修改仍在"。
- 重跑失败按 `failed` 落库（复用现有失败路径），返回可读错误。

### 4.6 撤销 undo

- 请求可带 `action_id`；缺省则撤销该 `(target_kind,email_id)` 的**最新未撤销动作**。
- 规则：
  1. 目标动作必须是最新一条"有效"动作，且不是 `undo`、未被撤销过；**若之后已有人操作 → 409**（防踩掉别人的修改，与乐观锁同一套口径）。
  2. 撤销 = 追加一条 `undo` 行（`undo_of = 目标 id`）+ 把 `before_state` 写回 `review_overrides`（`before_state` 为 null 则删除该行）。
  3. 撤销后 `review_overrides.updated_at` 刷新。

### 4.7 批量操作

- `POST .../review/bulk`：`{ email_ids: string[], action: "confirm"|"disposition"|"defer", payload }`。
- **逐条独立、失败隔离**：每条自己 try/catch，返回 `{ succeeded: string[], failed: {email_id,error}[] }`，一条失败不拖垮整批（同 `lib/shared/concurrency.ts` 精神与 `runBatchPipeline` 口径）。
- 同一批共享一个 `batch_id`（uuid），便于审计追溯与整批撤销识别。

## 5. 覆盖合并与提交导出

### 5.1 合并

`lib/shared/review/merge.ts` 导出 `applyOverrides(rows, overrides)`：

- 以系统结果为基础，覆盖 override 里存在的字段，重算 `has_defect`。
- `deferred` 项没有决策字段，等同系统结果（但计入未闭环统计）。
- 合并后**再过一次一致性校验**；不合法则回退系统结果并在服务端日志告警（不静默）。

### 5.2 导出接线

`app/features/results/logic/export/index.ts` 的 `buildSubmissionDocument()` 在拼 payload 后调用 `applyOverrides`，其余完整性口径不变：

- `X-Export-Invalid` 校验在**合并后**的值上进行（人工修正若造成矛盾，照样会被标出来）。
- 新增响应头（仅提示，不改变 `incomplete` 的既有口径）：
  - `X-Review-Pending`：**应复核但尚未处置**的项数 = `NEEDS_REVIEW` 未处置 + `MISMATCH` 未签字 + `failed`/`degraded` 未处理。
  - `X-Review-Deferred`：被搁置未闭环的项数。
  - 两者 > 0 时 `incomplete` 仍可为 false（提交格式合法），但前端应提示"还有 N 条未人工闭环"。

### 5.3 重要边界

**只有 `scope=submission` 套用人工覆盖**。`scope=results` / `conflicts` 仍展示系统原值，但队列项附 `override` 与 `effective` 两个字段供对比；两者不合并进导出正文，避免"看起来像官方结果"的歧义。

## 6. 口令与会话（写入口）

- 复核页首次进入要求输入管理员口令；**Server Action** 在服务端用 `getWriteAccess({ get('x-admin-token') })` 校验（复用 `lib/shared/write-policy.ts`，不另写一份口令逻辑）。
- 校验通过后下发 **httpOnly / SameSite=Lax / Secure** 的签名 cookie（如 `sdv-admin`）：
  - 内容 = `{ exp }` + HMAC-SHA256 签名；密钥由 `ADMIN_TOKEN` 派生（`sha256("sdv-review-session:" + ADMIN_TOKEN)`），**不新增环境变量**。
  - 明文 token 绝不出现在 cookie / localStorage / 响应体。
- 后续写操作由 Server Action 读 cookie、验签，通过后**服务端直接调用各模块 `logic/` 的复核函数**（`PHASE2_SPEC` §335-337 允许路径 1）。
- **硬性禁止**：任何"公网可触发、服务端自动注入 `ADMIN_TOKEN` 并转发写请求"的路由 / 代理 / Server Action。
- 读接口（队列、历史、导出）保持开放，匿名可看。

会话实现：`lib/shared/admin-session.ts`（`signSession` / `verifySession` / cookie 名常量）；Server Action 放 `app/core/review-session/actions.ts`（公共区，操作者维护）。

## 7. REST 契约（每模块新增，最终写入 SHARED_INTERFACES.md）

以 `classification` 为例（`<m>` = classification | extraction | comparison；pipeline 的重跑复用现有 `POST /features/pipeline/api`）：

| 路径 | 作用 | 口令 |
|---|---|---|
| `GET /features/<m>/api/review` | 复核队列：`review_state` `status` `reason` `include_ok` `q` `limit` `offset` | 免 |
| `GET /features/<m>/api/review/history?email_id=` | 某条的动作时间线 | 免 |
| `POST /features/<m>/api/review` | 应用一个动作：`{ email_id, action, payload?, note?, reason?, expected_updated_at? }` | 需 |
| `POST /features/<m>/api/review/undo` | 撤销：`{ email_id, action_id?, expected_updated_at? }` | 需 |
| `POST /features/<m>/api/review/bulk` | 批量：`{ email_ids[], action, payload? }` | 需 |

- 成功返回 `{ item: ReviewQueueItem, action: ReviewActionRow }`。
- 错误：参数错 400；未授权 401/403；乐观锁冲突 409；Supabase 不可用 503；其余 500。错误文案可读、不透传上游原文（`safeErrorMessage`）。
- 参数解析放各模块 `logic/params.ts` 或 `api/` 薄层，业务在 `logic/review.ts`。

## 8. MCP tool 契约（每模块新增）

| tool | 模块 | 读/写 | 注解 |
|---|---|---|---|
| `list_<m>_review` | 各模块 | 读 | `readOnlyHint: true` |
| `get_<m>_review_history` | 各模块 | 读 | `readOnlyHint: true` |
| `apply_<m>_review_action` | 各模块 | 写 | `readOnlyHint: false` |
| `undo_<m>_review_action` | 各模块 | 写 | `readOnlyHint: false` |

- 写 tool 必须显式 `readOnlyHint: false`（gate 按 fail-closed 判定，漏注解会被拦，不会漏）。
- 在 `app/core/mcp-server/tools.ts` 的汇总数组加各模块导出（只加一行，不含业务）。
- 自检：`npm run test:mcp-annotations` 必须通过。
- `pipeline` 作为 `target_kind` 特殊：它只提供队列（failed/degraded）+ `rerun` / `defer` 两类动作，不做字段修正；其队列仍由 `verification_overview` 读取，重跑调用现有 `POST /features/pipeline/api`（`email_ids` + `force=true`）或共享的 `lib/shared/review/rerun.ts`。

## 9. UI 待办（归队友A，见 UI_GUIDE.md）

每个模块 `ui/` 增加复核面板（或独立子页）：

- **队列**：默认异常驱动；筛选（复核状态/比对状态/原因/provider/failed）、排序、分页；"显示已判 OK 项"开关。
- **详情**：系统结论 + 抽取字段与出处（`evidence_si/bl`）+ 触发原因；动作按钮（确认/修正/分拣/搁置/备注/重跑）；动作时间线（history）；撤销按钮。
- **批量**：多选 + 批量确认/分拣/搁置。
- **共享组件**：撤销/搁置/审计时间线用一个共享组件（放 `app/_components/review/`），避免四遍。
- **口令**：复核页顶部/首次动作时弹出解锁表单；未解锁时只读。
- **移动端**：375px 无横向溢出（沿用现有 Tailwind 断点）。
- **新建导航入口**：侧边栏加"Review"（`app/dashboard/_components/sidebar.tsx`）。

后端提供接口、不在 `ui/` 写业务；前端不直连写接口，写走 Server Action。

## 10. 并发 / 错误 / 安全 / 规范符合性

- **乐观锁**：`review_overrides.updated_at`；两处写冲突返回 409 并由 UI 提示"这条已被他人修改"。
- **无模块级可变状态**：所有状态在请求局部或 Supabase；`lib/shared/review/` 不存进程级变量。
- **upsert**：`review_overrides` 冲突键 `(target_kind,email_id)`；`review_actions` 只 insert。
- **限并发**：批量动作逐条执行、逐条 try/catch；如需并发用 `mapWithConcurrencyLimit`，上限 ≤ 8。
- **错误处理**：外部调用（Supabase、rerun 的模型链）逐处 try/catch，返回可读错误；不透传上游原文。
- **写保护**：REST 写复用 `requireAdmin`；MCP 写靠 `readOnlyHint:false` + 汇总层 gate；GUI 走会话，不下发 token。
- **插件隔离**：不 import 其他 feature 的 `logic`；跨模块只通过 `lib/shared` 与类型通信。
- **文档同步**：实现时同步更新 [SHARED_INTERFACES.md](SHARED_INTERFACES.md)、[UI_GUIDE.md](UI_GUIDE.md)、[DATA_FLOW.md](DATA_FLOW.md)（结果层新增写者）、[docs/README.md](README.md) 索引；**不改 `AGENTS.md`/`CLAUDE.md`**（若改，必须两份逐字同步）。

## 11. 文件与归属

| 归属 | 文件 |
|---|---|
| 操作者（后端） | `lib/shared/review/{types,store,actions,merge,rerun}.ts`、`lib/shared/admin-session.ts`、`app/core/review-session/actions.ts`、`app/features/<m>/logic/review.ts`、`app/features/<m>/api/review/route.ts`、`app/features/<m>/mcp/index.ts`（加 tool）、`app/core/mcp-server/tools.ts`（加一行）、`scripts/review-schema.sql`、`results/logic/export/*`（接线） |
| 队友A（UI） | `app/features/<m>/ui/**`（复核面板）、`app/_components/review/**`（共享组件）、`app/dashboard/_components/sidebar.tsx`（入口） |
| 文档 | 本文件 + SHARED_INTERFACES / UI_GUIDE / DATA_FLOW / docs/README |

## 12. 验收标准

- 匿名访客：只能看队列与历史，触发任一写动作 → 401/403，`review_overrides` 无变化。
- 解锁后：确认 / 修正 / 分拣 / 搁置 / 重跑各成功一次，队列与有效结论正确变化，`review_actions` 有对应行。
- 撤销：撤销后 `review_overrides` 回到上一步；若期间他人已操作 → 409 且提示。
- 批量：10 条中 1 条故意非法 → 其余 9 条成功，返回 failed 明细，不整批失败。
- 导出：人工把某封 `NEEDS_REVIEW` 修正为 `OK` 后，`scope=submission` 该条为修正值；`X-Review-*` 头计数正确。
- 乐观锁：两条并发写同一项 → 后者 409。
- MCP：`npm run test:mcp-annotations` 通过；写 tool 匿名调用被拒。
- 移动端 375px 可用。

## 13. 非目标 / 后续（决赛）

- 不做真实登录与多用户鉴权（沿用分享口令）。
- 不做指派 assign / 升级 escalate（YAGNI，3 人团队）。
- 不做上传文档归类改造（`import` 已有 `review_status`，保持不动）。
- 不做 OCR（`unreadable` 的人工路径是"标记待补件/无法处理"）。
- 后续可加：复核 SLA/统计、`review_actions` 可视化报表、批量撤销。

## 14. 落地顺序（四个模块都做，只是先后）

1. 共用层：`scripts/review-schema.sql` + `lib/shared/review/*` + `lib/shared/admin-session.ts`（无 UI 也能用 REST 自测）。
2. `comparison`：最核心的 MISMATCH 签字闭环（确认/修正/搁置/撤销/重跑）。
3. `classification`：分拣去向；`extraction`：字段修正。
4. `pipeline`：failed/degraded 的队列与重跑接线。
5. `results` 导出套用覆盖（`applyOverrides` + `X-Review-*` 头）。
6. UI（队友A）按模块接入共享组件；侧边栏入口。
7. 文档同步（SHARED_INTERFACES / UI_GUIDE / DATA_FLOW / docs/README）+ 按第 12 节验收。

## 15. 实现记录（2026-09-21，后端 REST+MCP 完成，与本方案的偏差登记）

按 /council 评审沉淀②"实现与已批方案有偏差必须显式登记"的要求，记录这轮实现和本文件设计的几处不同：

1. **口令与会话（第6节）暂未实现 httpOnly cookie 会话（`admin-session.ts`/`review-session/actions.ts`）**。
   原因：这套 session 机制唯一的消费者是"GUI 不想把明文 token 下发给浏览器"，这一轮明确不做 GUI，
   REST/MCP 走的是和 `pipeline`/`mail`/`import` 完全一致的现成写法（请求头 `x-admin-token` +
   `getWriteAccess`）。在没有 GUI 去用它之前先建这套 cookie 机制，是"为还不存在的需求预先设计"，
   违反 CLAUDE.md 的通用规则第1条。**等队友A真正做复核页 GUI 时再补**，到时候 REST/MCP 的口令方式不变。
2. ~~分类的复核队列只覆盖"全模型失败降级"，不覆盖"Jev 置信度<0.85 但没失败"~~
   **2026-09-22 已修复**：裁判/队友实测后报了这个 bug（复核队列没有"系统无法判断邮件类型"的入口），
   操作者当场确认后加了新的 `review_reason=low_confidence_classification`（`REVIEW_REASONS` 第5个值，
   连带改了 `verification_results` 的 CHECK 约束），`lib/shared/pipeline.ts` 新增
   `applyClassificationConfidence` 把这个信号落库，`isInDefaultQueue` 的 classification 分支同步加了判断。
   见 `scripts/phase4-body-and-review-reason-migration.sql`、`docs/SHARED_INTERFACES.md`「人工复核闭环」一节。
   注意：只对之后新跑的结果生效，已有历史数据要重新跑一遍流水线才会补上标记。
3. **MCP 只做了 4 个只读/写 tool（list/history/apply/undo），没有单独的 bulk tool**——这个其实不是偏差，
   第 8 节的 MCP 契约表本来就只定义了这 4 种，批量操作按表格字面意思只留在 REST。
4. **实测中发现并修了一个真实 bug**：`lib/shared/review/store.ts` 最初用 PostgREST 的
   `.in("email_id", emailIds)` 按邮件ID批量取 override；submission 导出会一次传几百个 email_id 进来，
   拼进 URL 查询参数直接被 PostgREST 判 400 Bad Request（实测复现）。根因是 URL 长度限制，不是权限或
   数据问题。修法：`review_overrides` 本来就只有"被人工处理过的一小撮"，改成不带 `.in()` 条件、
   按 `target_kind` 整表取回再在内存里过滤，避免了这个问题，同时也更符合这张表的实际规模。
5. **验收方式**：本地起 `next dev`，对 comparison 模块实测了 confirm/correct/undo/bulk（含故意传一个不存在的
   `email_id` 验证失败隔离）/ 乐观锁冲突（409）/ 一致性校验（400）/ 导出叠加（`X-Review-Pending`/
   `X-Review-Deferred` 头随动作变化）全部通过，测试数据事后已从 `review_overrides`/`review_actions`
   清空，不留在共享数据库里；`npm run typecheck`、`npm run build`、`npm run test:mcp-annotations`
   （已更新写 tool 白名单，新增 8 个）均通过。GUI（第 9 节）与其余模块的 defer/undefer 细节界面化
   仍是队友A的待办。
