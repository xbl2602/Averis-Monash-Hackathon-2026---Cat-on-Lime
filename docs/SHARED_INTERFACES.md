# 模块间接口约定

三个模块（`classification` / `extraction` / `comparison`）之间要传递数据时，用这里定义的格式，不要各自发明。类型定义的唯一权威来源是代码文件 [`lib/shared/types.ts`](lib/shared/types.ts)，这份文档是给人看的说明，如果两边不一致，以代码为准，发现不一致要来更新这份文档。

## 输入：官方提供的邮件数据

样例数据在 `data/sample/`（复制自官方参赛者版 `sdoc-hackathon-bundle`，不含答案），读取方式见 [`lib/shared/inbox.ts`](lib/shared/inbox.ts)。

一封邮件长这样：

```ts
interface InboxEmail {
  email_id: string;       // 例如 "email_004"
  from: string;
  subject: string;
  body: string;
  attachments: string[];  // 例如 ["attachments/email_004_SI.txt", "attachments/email_004_BL.txt"]
}
```

## classification 模块的输出

```ts
type EmailCategory = "BL_COMPARISON" | "SI_REQUEST" | "INVOICE_QUERY" | "GENERAL" | "SPAM";

interface ClassifyEmailResult {
  category: EmailCategory;
  confidence: number | null;   // 0~1；只有 Jev 能给出，文本 LLM 路径为 null
  needs_review: boolean;       // 分类置信度偏低时 true，提示人工确认
}
```

只有 `BL_COMPARISON` 类的邮件才需要走后面的 extraction + comparison 流程。

## 用哪个模型（provider）

三个模块的 `api` / `mcp` 都接受一个**可选**参数 `provider`。缺省行为（2026-09-21 起）：分类 = 混合引擎（规则 → Jev → 文本模型链：首选 gemini，失败依次降级 deepseek → openai → claude → lmstudio，只试配了 key 的；全部失败用"尽力规则"降级并标 `needs_review`），抽取 = 规则优先、缺字段才用 Gemini 兜底，比对 = 规范化精确比较 + 文字候选差异交 Jev（Jev 失败时保守降级为"候选差异全部不一致"，不整封失败）。可选值来自 `lib/llm` 的 `LLM_PROVIDER_IDS`：`claude` / `openai` / `deepseek` / `gemini` / `lmstudio` / `jev`。前端下拉框要列 provider 时，直接用 `lib/llm` 导出的 `LLM_PROVIDERS`，不要自己另写一份清单。

- `jev`（TypeSafe System One 结构化决策模型）**只能做分类/比对**，靠 `callJev()` 调用，不能用于 extraction 那种"写出一段文字"的任务；extraction 的 REST/MCP 只接受文本 provider（`lib/llm` 的 `TEXT_PROVIDER_IDS`，明确排除 jev），显式传 jev 会得到可读的 400/参数错误。
- 不传 provider 的分类接口保持 `{ category, confidence, needs_review }` 三字段契约不变（混合引擎的 `engine` 字段不外露）。
- **降级标记（2026-09-21 起）**：混合引擎（不传 provider）降级时，结果层 `model_provider` 会带 `degraded`（分类尽力兜底）或 `rules-degraded`（比对 Jev 复核失败）；运维/GUI 可用 `provider=degraded` 子串筛出这些邮件，再用 pipeline 的 `retry_failed` 一键重试（接法见 UI_GUIDE.md 第二部分 §7）。**显式传 provider 时不会降级到别的模型**（选谁只试谁，避免"悄悄换模型装作成功"）。
- 该参数只在 `api` / `mcp` 层解析、传给 `logic`；`logic` 里的函数签名是 `{ ..., provider?: LLMProvider }`，默认值由 logic 自己兜底，UI 不传也能正常工作。

### REST 端点（三个基础模块，单文档、开放不需要口令）

| 路径 | 请求体 | 返回 |
|---|---|---|
| `POST /features/classification/api` | `{ email_id, provider? }` | `ClassifyEmailResult` |
| `POST /features/extraction/api` | `{ attachment_path, documentType: "SI"\|"BL", provider? }` | `ExtractDocumentResult` |
| `POST /features/comparison/api` | `{ si, bl, provider? }`（`si`/`bl` 是 `ExtractedDocumentFields`） | `CompareDocumentsResult` |

三个都不写库，**不需要 `x-admin-token`**（这条和 `PHASE2_SPEC.md`「写接口都要口令」是两回事，那条规则只管 config/mail/import 自己的接口）。GET 同一路径返回接口用法说明。

## extraction 模块的输出

对 SI 或 BL 里的一份文档文本，抽取下面 7 个字段（这是官方指定的字段，按"含义"对齐，不是按原文字段名对齐——SI 和 BL 上同一个字段的叫法可能不一样）：

```ts
const COMPARED_FIELDS = [
  "shipper",
  "consignee",
  "notify_party",
  "port_of_loading",
  "port_of_discharge",
  "container_count",
  "gross_weight_kg",
] as const;

type ExtractedDocumentFields = Partial<Record<typeof COMPARED_FIELDS[number], string>>;
```

`extractFields()` 返回的是完整结果（2026-09-20 起 REST/MCP 的返回格式同步变化）：

```ts
interface ExtractDocumentResult {
  document_type: "SI" | "BL" | "OTHER" | "UNKNOWN";  // OTHER = 明显不是 SI/BL（如发票/装箱单/产地证）
  fields: ExtractedDocumentFields;                    // 只包含真的抽到的字段；占位符(TBA/____MT)不算抽到
  extracted_by: "rules" | "llm";                      // 规则解析还是 LLM 兜底（规则优先，缺字段才兜底）
  evidence: ExtractedDocumentEvidence;                // 字段级出处（规则字段带 line+text；LLM 字段只有 source）
}
```

`evidence` 每个抽到的字段一条：规则路径给 `{ line, text, source: "rules" }`（行号从 1 开始，`text` 是实际取到值的那一行原文）；LLM 兜底字段只有 `{ source: "llm" }`，不给假出处。落库与查询格式见下文 results 模块（`evidence_si` / `evidence_bl`）。

一个 `BL_COMPARISON` 邮件需要抽取两次：一次对 SI 附件，一次对 BL 附件，各自得到一个 `ExtractDocumentResult`。

单文档接口的 `attachment_path` 会**按文件格式解析**（txt/pdf/xlsx/docx 都能读，统一走 `lib/shared/sample-inputs.ts` 的 `readSampleAttachmentParsed`，不要直接按 UTF-8 读附件）；读不出文字时 REST 返回 422、MCP 返回可读错误，不会给出一个假装成功的空结果。

## comparison 模块的输出

```ts
type ComparisonStatus = "OK" | "MISMATCH" | "NEEDS_REVIEW";
type ReviewReason = "wrong_doc_type" | "missing_attachment" | "unreadable" | "missing_value";

interface EmailVerificationResult {
  category: EmailCategory;
  status: ComparisonStatus;
  review_reason: ReviewReason | null;   // 只有 status 是 NEEDS_REVIEW 时才有值
  defect_fields: ComparedField[];        // status 是 MISMATCH 时列出哪些字段不一致
  has_defect: boolean;
}
```

**这个 `EmailVerificationResult` 就是最终要交的东西**——把每封邮件的这个结果，按 `{ [email_id]: EmailVerificationResult }` 拼成一个大对象，格式必须和官方给的 `data/sample/sample_submission.json` 完全一致（每个 email_id 都要有）。

比对引擎（`compareDocumentsHybrid`）在 Jev 复核失败时会保守降级（候选文字差异全部计入不一致），照常产出结果、不整封失败；降级只记录在结果层的 `model_provider`（含 `rules-degraded`），不进提交格式。导出 `scope=submission` 前会做一次格式校验（2026-09-21），见下文"导出（Save as）"。

## 编排层与混合引擎（pipeline）

`lib/shared/pipeline.ts` 是唯一拼"分类 → 抽取 → 比对"顺序的地方：

- `runEmailPipeline`：单封邮件 → `EmailVerificationResult`，同时负责 4 种"拿不准"判定（missing_attachment / wrong_doc_type / unreadable / missing_value）
- 附件配对：文件名 `_SI`/`_BL` 优先；有缺位时按内容识别补缺（关键词规则 → 判不出才问模型链），同一附件不会被两边抢用（2026-09-21，决策 26）
- 失败降级：分类/比对任一模型环节失败都不会让整封邮件崩——分类走 provider 链 + 尽力规则兜底（`engine=degraded`）、比对走保守口径（`rules-degraded`）；`retry_failed` 可一键重算这些邮件（2026-09-21，决策 25）
- `runBatchPipeline`：批量（限量并发、单封失败隔离）
- `computeInputHash` + `PIPELINE_LOGIC_VERSION`：结果层增量跳过的依据

引擎是混合模式（省调用、稳结果）：分类规则优先（拿不准才 Jev，置信度 < 0.85 标人工复核）；抽取标签规则优先（缺字段才 LLM 兜底）；比对规范化精确比 + 文字字段候选差异交 Jev 复核（noul < 0.85 判为不一致，校准过程见 DECISION_LOG 决策 22），数字字段不进 Jev。

模型调用都走 `lib/shared/llm-cache.ts`（`llm_call_cache` 表的"内容指纹"缓存；没配 service key 时自动降级为不缓存）。**改规则/prompt/阈值后：bump `PIPELINE_LOGIC_VERSION`（让旧结果重算）；prompt 有实质变化再 bump `LLM_CACHE_VERSION`（让旧缓存失效）。**

本地评测：`npm run evaluate`（对照 ground_truth 自测 + 增量写入 verification_results；`--force` 强制重算，`--limit=N` 调试，`--no-write` 只算分）。

## 数据库存储层（Supabase）

四张表，命名规则：**看名字就知道装什么、属于流水线哪一层**。前两张由导入脚本 `scripts/import-sample-data.mjs`（`npm run import:data`，支持增量）填充；第三张由评测/流水线（`npm run evaluate`，以后加批量入口）按 `email_id` upsert 写入；第四张是模型调用的内部缓存。

| 表 | 层 | 装什么 | 谁写 |
|---|---|---|---|
| `raw_emails` | 原始层 | `email_id` / `from_address`（对应邮件里的 `from`）/ `subject` / `body` / `normalized_body` / `attachment_paths` / `content_hash` | 导入脚本（upsert，冲突键 `email_id`） |
| `parsed_attachments` | 文字层 | `email_id` + `file_path` 为主键；`file_format`（txt/pdf/xlsx/docx/unsupported）；`parse_status`（ok/unreadable）；`parse_error`；`parsed_text`（解析出的文字）；`normalized_text`（扁平化文本）；`content_hash` | 导入脚本（upsert，冲突键 `email_id,file_path`） |
| `verification_results` | 结果层 | `category` / `comparison_status` / `review_reason` / `defect_fields` / `defect_count`（生成列，自动等于 `defect_fields` 的个数）/ `has_defect` / `extracted_si` / `extracted_bl` / `evidence_si` / `evidence_bl`（字段级出处，2026-09-21 新增，迁移见 `scripts/phase3-evidence-migration.sql`）/ `model_provider` / `input_hash` / `logic_version` / `processing_status`（ok / failed）/ `error_message` | 本地评测 `npm run evaluate`、批量入口（`POST /features/pipeline/api` / MCP `run_batch`）：upsert，冲突键 `email_id`；处理失败的邮件也写一行（`processing_status='failed'` + `error_message`），下次重跑会自动重试 |
| `llm_call_cache` | 调用缓存 | `cache_key`（指纹）/ `purpose` / `provider` / `model` / `request_payload` / `response_payload` / `last_used_at` | 服务端缓存层（upsert，不对外开放） |

**指纹（`*_hash`）统一算法**：sha256(该行要存的全部内容做 JSON 序列化)。作用：

- `raw_emails.content_hash` / `parsed_attachments.content_hash`：增量导入时内容没变就跳过
- `verification_results.input_hash` + `logic_version`：增量跑分时输入没变、引擎版本没变就跳过
- `llm_call_cache.cache_key`：模型调用级缓存键（含用途+版本+模型+实际发送内容），输入没变就不重复调用

约定：

- 写入一律 **upsert**（不要"先查存不存在再插"）。`updated_at` 的实际约定（2026-09-20 核对）：**写入方显式设置**——`scripts/phase2-schema.sql` 里各表只有 `default now()`、没有触发器，插入时生效、update 不会自动刷新；`verification_results.updated_at` 的刷新机制未在本仓库定义（写模式重算后该列不会自动变），以控制台实际 DDL 为准，需导出核对。
- 权限（可复查口径）：`raw_emails` / `parsed_attachments` / `verification_results` 和只读视图 `verification_overview` **必须保留 anon select 策略**——否则 results 的 list/stats/conflicts/export 与 pipeline 的增量读取会全部失败；写入只有 service role。`llm_call_cache` 只有 service role 能读写，但会被匿名只读接口**顺带写入**缓存行（缓存键含输入指纹，不能伪造他人结果）。主三表/视图/缓存的 DDL 与策略不在仓库，需从现有控制台导出后补进 `scripts/`；第二阶段 4 表的脚本是 `scripts/phase2-schema.sql` + `scripts/phase2-rls.sql`。
- 扁平化统一用 [`lib/shared/normalize.ts`](lib/shared/normalize.ts) 的 `normalizeText`，不要在别处再写一份

### 结果查询视图 `verification_overview`

`results` 模块不直接拼 `raw_emails` + `verification_results`，而是只读一个数据库视图：

- 每封原始邮件一行，左连接结果行；未处理的邮件 `processing_status='pending'`、`processed=false`
- 视图设了 `security_invoker = true`（底层 RLS 照常生效），只开放 select
- 为什么用视图：PostgREST 的内嵌（embedded）排序实测**不会影响父行顺序**，内嵌筛选还要求 `!inner` 才不返回多余父行；扁平视图可以让筛选/排序/分页/统计稳定工作，也避免每个查询各写一套连接逻辑

## results 模块（结果查询 / 统计 / 冲突对 / 导出）

只读模块，给 Web UI、其他程序、AI agent 用；三种入口共用同一套 `logic/` 实现（不重复造轮子）。
数据来源只有 `verification_overview` 视图，不写任何表。

### REST 接口（全部 GET，只读）

| 路径 | 作用 | 主要参数 |
|---|---|---|
| `/features/results/api` | 按需求查结果列表（含未处理邮件）：邮件信息 + 分类 + 比对结果 + 抽取字段 | `category` `status` `processing` `has_defect` `provider` `q` `sort_by` `order` `group_by` `limit` `offset` |
| `/features/results/api/stats` | 统计汇总 | 无 |
| `/features/results/api/conflicts` | 冲突文件对（默认 MISMATCH + NEEDS_REVIEW） | `status` `q` `sort_by` `order` `limit` `offset` `numeric_mode` `tolerance` `value_field` `value` |
| `/features/results/api/export` | Save as：返回带 `Content-Disposition` 的文件内容 | `scope` `format` + 上面的筛选参数 |

- 多值参数用逗号分隔（`status=MISMATCH,NEEDS_REVIEW`）或同名参数重复；`limit` 默认 50、最大 200
- 数值搜索（2026-09-21 新增，P1-6，**只影响查询、不影响官方提交**）：
  - `numeric_mode=exact|fuzzy`（默认 exact）：fuzzy = 差值在容差内的数字字段不再算冲突
  - `tolerance`（≥0，仅 fuzzy 可用）：重量单位 kg；不传用默认（重量 max(0.5kg, 0.1%)、箱数 0）
  - `value_field=container_count|gross_weight_kg` + `value=<数字>`（成对出现）：按值搜索，命中 SI/BL 任一侧
  - 非法组合（如 exact 带 tolerance、缺一半的成对参数）返回中文 400；该筛选在 logic 层做，导出 conflicts 同样支持
- `sort_by` 白名单：`email_id` / `category` / `comparison_status` / `defect_count` / `updated_at`；`order` 缺省：按 `email_id` 升序、其余降序
- `group_by=category|comparison_status` 时返回 `groups`（对筛选后的全集计数，不是只算当前页）
- 参数不合法返回 400（中文错误信息）；Supabase 未配置/连不上返回 503

响应格式（列表）：

```ts
interface ResultListResponse {
  total: number; limit: number; offset: number;
  sortBy: "email_id" | "category" | "comparison_status" | "defect_count" | "updated_at";
  order: "asc" | "desc";
  groupBy: "category" | "comparison_status" | null;
  groups: { key: string; count: number }[] | null;
  items: {
    email_id: string; from: string; subject: string; attachment_paths: string[];
    category: EmailCategory | null;                 // 未处理时为 null
    comparison_status: ComparisonStatus | null;
    review_reason: ReviewReason | null;
    defect_fields: string[]; defect_count: number; has_defect: boolean;
    processing_status: "ok" | "failed" | "pending"; // pending = 还没处理
    error_message: string | null; model_provider: string | null; logic_version: string | null;
    updated_at: string | null;
    extracted_si: Record<string, string> | null;
    extracted_bl: Record<string, string> | null;
    evidence_si: ExtractedDocumentEvidence | null;  // 字段级出处（规则字段有 line/text；LLM 字段只有 source）
    evidence_bl: ExtractedDocumentEvidence | null;
  }[];
}
```

统计响应（`get_stats`）：

```ts
interface StatsResponse {
  total_emails: number; processed: number; pending: number; failed: number;
  mismatch: number; needs_review: number;
  by_category: Record<string, number>;   // 5 个类别 + NOT_PROCESSED
  by_status: Record<string, number>;     // OK / MISMATCH / NEEDS_REVIEW + NOT_PROCESSED
  defect_field_frequency: { field: string; count: number }[];
  providers: Record<string, number>;     // model_provider 的分布
  last_updated_at: string | null;
}
```

冲突对响应：`{ total, limit, offset, sortBy, order, items }`，其中每条 item 是
`{ email_id, from, subject, si_file, bl_file, other_files, status, review_reason, defect_fields, defect_count, si_values, bl_values, si_evidence, bl_evidence, updated_at }`（`si_evidence/bl_evidence` 为字段级出处，2026-09-21 新增）。

### 导出（Save as）

- `scope`：`results`（当前筛选的结果列表）/ `conflicts`（冲突文件对）/ `stats`（统计汇总）/ `submission`（官方提交纯 JSON：`{ email_id: EmailVerificationResult }`，只允许 `format=json`）
- `format`：`json` | `md` | `txt`（json 是结构化数据，md/txt 是给人看的报告，含统计摘要 + 明细）
- 文件名在响应头 `Content-Disposition`；`scope=submission` 时用一组响应头判断是否覆盖了全部 520 封（完整性 fail-closed）：
  - `X-Export-Incomplete`：任意一项异常即 `true`（Expected-Source 非 sample、条数 ≠ 分母、有缺失、有过期版本、有失败行）
  - `X-Export-Expected-Source`：`sample` = 分母锚定官方样例清单（data/sample/inbox 的文件名）；`db-fallback` = 清单读不到、降级用数据库总数——**此时即使 `Missing=0` 也按不完整处理**
  - `X-Export-Missing` / `X-Export-Missing-Ids`：清单里有、导出里没有的 email_id（头里最多列 20 个）
  - `X-Export-Stale` / `X-Export-Stale-Ids`：有结果但 `logic_version` 与当前引擎版本不一致的 email_id（旧版本结果需要重跑）
  - `X-Export-Invalid` / `X-Export-Invalid-Ids`（2026-09-21 新增）：行内字段自相矛盾（MISMATCH 没有缺陷清单、NEEDS_REVIEW 却带缺陷或缺原因、OK 带缺陷/原因）的 email_id；有任意一条时 `incomplete` 也为 true
  - 注意：前端要 `fetch + blob` 才能读到这些头，`<a>` 直接下载读不到

### MCP tool（端点 `POST /core/mcp-server`）

| tool | 对应 REST |
|---|---|
| `list_results` | `/features/results/api` |
| `get_stats` | `/features/results/api/stats` |
| `list_conflicts` | `/features/results/api/conflicts` |
| `export_results` | `/features/results/api/export`（`content[0].text` 就是文件内容，文件名等元信息在工具结果的 `_meta` 里） |

MCP 传输方式是无状态 Streamable HTTP + JSON 响应（GET/DELETE 返回 405）。本地开发用
`http://localhost:3000/core/mcp-server`，线上用 `https://hackathonaveris.vercel.app/core/mcp-server`。

## pipeline 模块（批量入口）

`app/features/pipeline/` 是"整箱流水线"的入口：调用 `lib/shared/pipeline.ts` 的
`runBatchPipeline` 把样例邮件按"分类→抽取→比对"跑一遍，并 upsert 进 `verification_results`。
它是**会写库**的模块（和只读的 results 模块分开），引擎逻辑一行都不重复实现。

### REST：`POST /features/pipeline/api`

请求体（JSON，全部可选）：

| 字段 | 说明 |
|---|---|
| `email_ids` | 只跑这几封（数组；不传 = 全部 520 封）；不存在的 id 返回 400 |
| `limit` | 单次最多跑几封，1~520，默认 50；剩余数量在响应的 `remaining` 里（Vercel 函数上限 60s，大批量分几次调）。匿名（未带口令）的 `dry_run` 预览再封顶 20 封 |
| `force` | true = 忽略增量指纹强制重算，默认 false |
| `dry_run` | true = 只算不写库（不需要 service key），默认 false；匿名时只预览清单头部固定前缀（≤20 封） |
| `provider` | 文本兜底模型，默认 gemini；不能用 jev（返回 400） |
| `concurrency` | 同时最多处理几封（也是一块的大小），1~8，默认 4 |
| `retry_failed` | true = 一键重试（2026-09-21 新增）：服务端自动挑出结果表里 `processing_status='failed'` 或 `model_provider` 含 `degraded` 的邮件并强制重算；不能和 `email_ids` 同时用；没有目标时 `ran=0` 正常返回 |

响应（`RunBatchSummary`）：

```ts
interface RunBatchSummary {
  total_emails: number; selected: number; skipped: number;
  ran: number;                    // 本次实际完成数（成功+失败）；deadline 截断时不谎报
  succeeded: number; failed: number; wrote: number;
  remaining: number;              // 目标 − 已完成：匿名预览目标=清单规模，其余=本次待跑总数
  stopped_by_deadline: boolean;   // true = 到了 30s deadline 且仍有没跑完的目标（remaining>0）
  dry_run: boolean; logic_version: string; duration_ms: number;
  failures: { email_id: string; error: string }[];   // 最多列 20 条
}
```

增量规则：结果表里已有该邮件、`processing_status='ok'`、`input_hash` 和 `logic_version`
都一致的，直接跳过（`skipped`）；上次是 failed 的会自动重跑。写入用 upsert（冲突键
`email_id`），成功的行写 `processing_status='ok'`，失败的行也写
`processing_status='failed'` + `error_message`（不挡其他邮件）。

执行方式（2026-09-20 性能/可靠性评审后）：待跑邮件按 **一块 = 一个并发波次**（块大小 =
`concurrency`）分块，每块结束后检查 **30s deadline**（`BATCH_DEADLINE_MS`），到了就不再取新块；
`!dry_run` 时结果行攒到 ≥20 条就 upsert 一次，deadline 停止/全部结束时补 flush（进程被平台杀掉时，
丢失上界 = 一个在途块 + 未 flush 的行数）。`ran`/`remaining` 都按"实际完成数"计算，
所以 deadline 截断时不会显示成"跑完了"——重复调用即可续跑（写模式自动跳过已算好的增量）。

错误：参数错 400；写模式未授权 401（口令错）/ 403（服务端未配置 `ADMIN_TOKEN`）；
需要写库但缺 `SUPABASE_SERVICE_ROLE_KEY` 时 503（提示可改用 `dry_run`）；其余 500。
GET 同一个地址返回接口用法说明。

匿名预览语义（`dry_run=true` 且未带口令）：只解析/处理清单头部固定前缀（单次 ≤20 封，`selected` = 实际解析数），
**每次调用都从头开始、没有游标**；`remaining` 表示"清单规模 − 本次实际处理数"，不代表"再调几次能跑完"。
dry_run 不写库，所以预览结果不会累积；要看 520 封完整体用带口令的非 dry_run 模式分批续跑。

### MCP tool：`run_batch`

参数与 REST 请求体一一对应（snake_case 相同）；注解是 `readOnlyHint: false`
（与查询类 tool 区分），结果就是上面的 `RunBatchSummary`。

写保护：`dry_run=false` 需要 `x-admin-token` 请求头（MCP 客户端 header 方式配置）；
`dry_run=true` 允许匿名预览（单次封顶 20 封）。只读 tool 全部显式声明 `readOnlyHint: true`，
汇总层 gate 按 `readOnlyHint !== true` fail-closed 判定（未注解 = 需要口令）。

## 人工复核闭环（review，P1-1）

设计规范见 [REVIEW_SPEC.md](REVIEW_SPEC.md)（权威说明，含动作语义、数据模型、并发/安全）；这里只记对外契约。
**实现范围**：四个模块（classification/extraction/comparison/pipeline）的 REST + MCP 都已实现；
**GUI 未实现**（队友A的待办，见 UI_GUIDE.md）。共用逻辑在 `lib/shared/review/`（不是任何一个 feature 内部）。

### REST 契约（每个模块相同形状，`<m>` = classification | extraction | comparison | pipeline）

| 路径 | 方法 | 作用 | 口令 |
|---|---|---|---|
| `/features/<m>/api/review` | GET | 复核队列：`?include_ok&q&status&reason&review_state&limit&offset` | 免 |
| `/features/<m>/api/review` | POST | 应用一个动作：`{ email_id, action, payload?, note?, reason?, expected_updated_at? }` | 需 `x-admin-token` |
| `/features/<m>/api/review/history` | GET | `?email_id=` 某条的动作时间线 | 免 |
| `/features/<m>/api/review/undo` | POST | `{ email_id, action_id?, expected_updated_at? }` | 需 |
| `/features/<m>/api/review/bulk` | POST | `{ email_ids[], action: "confirm"\|"disposition"\|"defer", payload? }`，逐条独立、失败隔离，返回 `{ batch_id, succeeded[], failed[] }` | 需 |

`action` ∈ `confirm / correct / disposition / defer / undefer / note / rerun`（`undo` 走独立端点，不在这个枚举里）。
`payload` 字段：`category`（分类改判）/ `comparison_status`+`review_reason`+`defect_fields`（比对改结论，三者必须自洽：
MISMATCH 必有缺陷无原因、NEEDS_REVIEW 必有原因无缺陷、OK 都没有，否则 400）/ `extracted_si`+`extracted_bl`（抽取字段修正）/
`disposition`（分拣去向，六选一）/ `provider`（仅 `rerun` 用，指定重跑用哪个模型）。

响应形状：`{ item: ReviewQueueItem, action: ReviewActionRow }`（undo 同形状）；bulk 是
`{ batch_id, succeeded: string[], failed: { email_id, error }[] }`。类型定义见 `lib/shared/review/types.ts`。

**队列默认过滤（异常驱动，`include_ok=true` 才看全部）**，各模块口径不同：
- `comparison`：`comparison_status ∈ {MISMATCH, NEEDS_REVIEW}`
- `extraction`：`comparison_status=NEEDS_REVIEW` 且 `review_reason ∈ {missing_value, wrong_doc_type, unreadable}`
- `classification`：`model_provider` 的分类器分段 = `degraded`（即"全模型失败降级"）
- `pipeline`：`processing_status=failed` 或 `model_provider` 含 `degraded`

**已知缺口**：分类的"Jev 置信度 < 0.85 但没有全失败"这种拿不准，目前**没有持久化**到 `verification_results`
（`classifyEmailHybrid` 算出的 `needs_review` 只在单文档接口即时返回，批量流水线没有存这个信号），所以
classification 复核队列目前只覆盖"降级"这一种情况，不覆盖"低置信度但 Jev 正常返回"这种。要补齐需要在
`verification_results` 加一列持久化分类置信度/needs_review，这是一次单独的 schema 改动，未包含在本轮范围内。

错误：参数错/一致性校验不过 400；口令错 401；未配置 `ADMIN_TOKEN` 403；查无邮件 404；
乐观锁冲突（`expected_updated_at` 不匹配，或撤销的不是最新动作）409；其余 500。

### MCP tool 契约（每个模块 4 个，共 16 个）

`list_<m>_review`（只读）/ `get_<m>_review_history`（只读）/ `apply_<m>_review_action`（写，`readOnlyHint:false`）/
`undo_<m>_review_action`（写，`readOnlyHint:false`）。参数/返回与 REST 一一对应；MCP 没有单独的 bulk tool
（批量目前只走 REST）。

### 导出接线（results 模块）

`scope=submission` 的导出会调用 `lib/shared/review/merge.ts` 的 `applyOverridesToSubmission`：
只有 `classification`（改 `category`）和 `comparison`（改 `status`/`review_reason`/`defect_fields`）两个
target_kind 的覆盖会进最终提交格式（`extraction`/`pipeline` 的覆盖不直接影响提交，官方格式本来就不含抽取字段）；
`review_state=deferred` 的覆盖不生效（等同系统结果，但计入统计）。响应头新增
`X-Review-Pending`（应复核未处置数）、`X-Review-Deferred`（被搁置未闭环数），MCP `export_results` 的 `_meta`
同步 `review_pending`/`review_deferred`。**只有 `scope=submission` 套用覆盖**，`results`/`conflicts` 仍展示系统原值。

### 数据库

`review_overrides`（当前生效的人工结论，`unique(target_kind,email_id)`，写入一律 upsert）+
`review_actions`（append-only 审计日志）。DDL 见 `scripts/review-schema.sql`；读对 anon 开放，写走 service role。

## config 模块（运行时配置中心，第二阶段）

`app/features/config/`：GUI 可调的运行时配置。**数据库有值 > 环境变量 > 代码默认值**；
敏感值（API key 等）用 AES-256-GCM 加密存储（[`lib/shared/crypto.ts`](lib/shared/crypto.ts)），
接口**永不回显明文**，只回掩码（如 `sk-ant-…f3a2`）+ `has_value`。

### REST

| 路径 | 作用 | 保护 |
|---|---|---|
| `GET /features/config/api` | 读全部配置（`?category=llm|pipeline|storage|mail|general` 过滤） | 开放 |
| `PUT /features/config/api` | 批量写：`{ updates: [{ key, value }] }`（value=null 删除该行，回到 env/默认） | 需 `x-admin-token` |
| `POST /features/config/api/test` | 测试连接：`{ target }` → `{ ok, detail }` | 需 `x-admin-token` |

读响应每项形如 `{ key, category, value, is_secret, has_value, source: "db"|"env"|"default"|"unset", updated_at }`。
配置项清单和环境变量对应关系见 [PHASE2_SPEC.md](PHASE2_SPEC.md) 第 3.2 节。

**当前接线状态（2026-09-20 核对，避免误解）**：数据库里存的配置目前只有 **测试连接**与 **config CRUD** 会消费；
`llm.*_api_key` 不会被 `lib/llm` 自动读取（运行时仍读环境变量）；`provider_priority` / 阈值 / `pipeline.*` /
`storage.*` 仍是**展示项**，改了不会立刻改变运行时行为。`resolveConfigValue()` 已备好（数据库 > env > 默认），
等真正接线时再逐项切换。

### 写保护（所有写接口共用）

请求头 `x-admin-token: <ADMIN_TOKEN>`；`ADMIN_TOKEN` 未配置时**拒绝所有写操作**（安全默认，403）；
口令错误返回 401。读取接口全部开放（裁判/访客自由查看）。策略的唯一实现是
[`lib/shared/write-policy.ts`](lib/shared/write-policy.ts)（REST 与 MCP 汇总层共用，不依赖 Next.js），
REST 的 NextResponse 包装见 [`lib/shared/admin-guard.ts`](lib/shared/admin-guard.ts)。

**覆盖范围（会写库的入口）**：
- REST：`PUT /features/config/api`、`POST /features/config/api/test`、mail 的写接口、import 上传/人工归类、
  **pipeline 的 `dry_run=false`**
- MCP：`run_batch`（`dry_run=false`）、`classify_uploaded_document`、`sync_gmail`（一律需口令）
- 匿名可用：`run_batch` 的 `dry_run=true` 预览（单次封顶 20 封、不写库）；其余写入口匿名一律拒绝

**写业务数据需要口令；LLM 调用结果缓存 `llm_call_cache` 会被匿名只读接口顺带写入**（缓存键含输入指纹，不能伪造他人结果）。

**GUI 做写操作的两种允许路径**（token 不进浏览器）：
1. Server Action / 服务端代码直接调本仓库的 logic 函数（如 `upsertConfig()`）——**调用前必须先完成口令校验**（如操作者手动输入、服务端用 `getWriteAccess` 校验通过，不允许因为"是页面内部调用"就跳过后门）；同一 app 内最省事，推荐
2. 服务端 fetch REST 接口时注入 `process.env.ADMIN_TOKEN`——**仅在服务端已完成口令校验之后**（如操作者手动输入口令、服务端验证通过后的转发）

**【禁止】** 创建"公网可触发、服务端自动注入 `ADMIN_TOKEN` 并转发写请求"的路由/代理/Server Action——那等于匿名可写库。

不要在浏览器端直连写接口（否则需要把 token 下发给浏览器，违背保护初衷；读取接口可以随便在浏览器直连）。

## mail 模块（Gmail / 多 Supabase 项目，第二阶段占位）

`app/features/mail/`：**本阶段是预留接口，不做真实 OAuth 链路**（见 PHASE2_SPEC 第 0 节）。

| 路径 | 作用 | 保护 |
|---|---|---|
| `GET /features/mail/api/gmail` | Gmail 连接状态（token 列只折算成 `has_access_token` 布尔） | 开放 |
| `POST /features/mail/api/gmail/connect` | 发起连接 → `{ status: "not_implemented", message, redirect_uri }` | 需 token |
| `POST /features/mail/api/gmail/disconnect` | 清 token、置 `disconnected` | 需 token |
| `GET /features/mail/api/supabase-projects` | 列出配置的项目（service_key 只回掩码） | 开放 |
| `POST /features/mail/api/supabase-projects` | 新增/更新项目（service_key 加密存） | 需 token |
| `POST /features/mail/api/supabase-projects/activate` | 切换启用项目（同一时间只有一个 `is_active`） | 需 token |
| `POST /features/mail/api/supabase-projects/deactivate` | 停用当前启用项目（切换失败后的恢复通道） | 需 token |

Supabase 客户端解析：**启用项目（`supabase_projects.is_active`） > 环境变量**——写库类代码请用
[`lib/shared/supabase.ts`](lib/shared/supabase.ts) 的 `getSupabaseServiceClientAsync()`（每次现解析现建，
不缓存）；解析管理表本身固定用 env 引导客户端，避免自依赖。

**客户端清单（2026-09-20 核对，A3）**：
- 走 async（支持切换项目）：`config`、`mail`（及其管理表）
- 仍走环境变量（`getSupabaseClient` / `getSupabaseServiceClient`）：`results`、`pipeline`、`import`、
  `llm-cache`、`verification-store`、评测脚本 `scripts/evaluate.ts`
- **切换启用项目目前只对 config/mail 生效**：演示期间不要切换项目，否则两套数据源会不一致

## import 模块（手动上传文档，第二阶段）

`app/features/import/`：单件/多选/文件夹上传（GUI 侧用 `webkitdirectory` 拿文件列表、**按 3MB/批**
切开逐个请求）。原文件存 Storage bucket `uploads`（private，路径 `documents/<hash前2位>/<hash>/<文件名>`），
元数据+解析文本落 `uploaded_documents`。

| 路径 | 作用 | 保护 |
|---|---|---|
| `POST /features/import/api/upload` | `{ files: [{ name, mime?, data_base64 }], batch_id? }`；逐文件校验（扩展名→魔数→大小→哈希去重→解析→识别）；单文件失败不影响其他；整批 >3MB 返回 413 | 需 token |
| `GET /features/import/api/documents` | 列表（`?review_status=&detected_type=&limit=&offset=`；`extracted_text` 只回 500 字符预览） | 开放 |
| `GET /features/import/api/documents/[id]` | 单文档详情（含 `extracted_text` 全文） | 开放 |
| `PUT /features/import/api/documents` | 人工归类：`{ id, detected_type }` + 置 `filed`（支持 `expected_updated_at`，过期 409） | 需 token |

上传结果 `items[]`：`status` = `stored` / `duplicate`（内容哈希已存在，不重复解析）/ `rejected`（原因可读）；
`detected_type` = `SI` / `BL` / `OTHER` / `UNKNOWN`（**按内容识别，不信任文件名**；
`UNKNOWN` 进 `review_status=pending` 等人工归类）。识别规则见 [`lib/shared/document-identify.ts`](lib/shared/document-identify.ts)。

### MCP tool（第二阶段新增）

`sync_gmail`（占位，返回 not_implemented）、`list_uploaded_documents`、`classify_uploaded_document`（写库）。
加上原有的 8 个，现在共 11 个 tool（8 个只读 + 3 个写库；写 tool 需 `x-admin-token`，只有 `run_batch` 的
`dry_run=true` 允许匿名预览）。

## sandbox 模块（评委自带文档临时测试，P2）

**背景**：`classification`/`extraction` 的单文档接口只能对着仓库自带的样例数据用（传 `email_id` /
`attachment_path`，指向 `data/sample/`），评委自己带一份新的 SI/BL 文档、或临时换一封邮件测试时，
之前没有任何接口能接住——这正是决策记录21提到的真实风险（"决赛现场评委临时换一封邮件测试"）。
`app/features/sandbox/` 补这个缺口：直接接收上传的文件内容，跑一次分类（可选）+ 抽取 + 比对，
**不写库、不需要配置 Supabase**，用完即丢，Vercel 和本地/Docker 行为完全一致。

| 路径 | 作用 | 保护 |
|---|---|---|
| `POST /features/sandbox/api` | `{ subject?, body?, from?, si: {name,data_base64}, bl: {name,data_base64}, provider? }` → `{ classification, extraction:{si,bl}, comparison }` | 开放（不写库，不需要口令） |

- `subject`/`body` 都不给 → `classification` 返回 `null`（只测抽取+比对）；给了任一个就会跑分类。
- `si`/`bl` 必填，支持 `.txt`/`.md`/`.pdf`/`.docx`/`.xlsx`，**单文件不超过 1.5MB**（两份文件要一起塞进一次
  JSON 请求体，留够 Vercel ~4.5MB 请求体上限的余量；这个场景是"贴一份单证测试"，不是批量归档，
  没有对齐 import 模块 20MB 的上限）。文件校验（扩展名白名单 → base64 解码复核 → 魔数校验）复用
  [`lib/shared/file-validate.ts`](lib/shared/file-validate.ts)——这是从 `import` 模块的校验逻辑里提出来的
  公共层，两个模块共用一套规则，import 模块自己的行为没有变化。
- 抽取/比对引擎和生产环境完全一致（`extractFields` 规则优先+Gemini兜底、`compareDocumentsHybrid`
  规则+Jev复核），不是简化版——评委测出来的结果和系统正式跑出来的结果同一套标准。
- `provider` 可选，语义同其余模块；传 `jev` 时抽取会忽略它、用自己的默认值（Gemini），因为 Jev 不做文本抽取。

### MCP tool

`run_adhoc_test`（只读——不写任何库，用完即丢），参数/返回与上面的 REST 端点一一对应。

## 环境变量约定

见 [`.env.example`](.env.example)，新增需要的环境变量时同步更新那个文件（不要把真实 key 提交进 git）。
第二阶段新增两个：
- `ENCRYPTION_MASTER_KEY`：敏感配置的 AES-256-GCM 主密钥（32 字节 base64）；缺失时敏感字段拒绝写入
- `ADMIN_TOKEN`：config/import/mail 写操作的口令（`x-admin-token` 请求头）；未配置时写操作全部被拒绝

## LLM 调用约定

所有模块都通过 [`lib/llm/index.ts`](lib/llm/index.ts) 导出的 `callLLM(provider, prompt, options)` 调用 LLM，不要在 feature 模块内部直接 import 具体某个 LLM 的 SDK。可用的 `provider` 值见上面的"用哪个模型（provider）"。

**Jev 是例外**：它不生成文本，走 `lib/llm` 导出的另一个函数 `callJev(state, questions)`（实现在 [`lib/llm/jev.ts`](lib/llm/jev.ts)），输入一组 typed question（`noul` 是/否概率 / `choice` 选项 / `score` 打分），返回带 `confidence` 的结构化答案。环境变量是 `TYPESAFE_API_KEY`（选填 `JEV_MODEL`，默认 `jev-latest`），见 [`.env.example`](.env.example)。

## MCP tool 约定

每个 feature 的 `mcp/index.ts` 导出 `{ name, description, inputSchema, handler }` 形状的对象，由 `app/core/mcp-server/tools.ts` 统一汇总注册（一个模块可以导出多个，用数组，如 `resultsMcpTools`），不要自己在别的地方重复注册。handler 返回普通对象时由汇总层转成 JSON 文本；需要返回文件内容/MCP 原生结果时，可以直接返回 `{ content: [...], _meta }`。

三个基础模块各自的 tool 名（只读，`readOnlyHint:true`，参数/返回与上面的 REST 端点一一对应）：
`classify_email`（classification）/ `extract_document_fields`（extraction）/ `compare_documents`（comparison）。
其余模块的 tool 清单见各自章节（results 4 个、pipeline 1 个、mail/import 各自的、人工复核闭环 16 个）。

**注解是硬约定（写保护 gate 按此 fail-closed 判定）**：只读 tool 必须显式声明 `readOnlyHint: true`；
会写库的 tool 必须显式声明 `readOnlyHint: false`；未声明的一律按"需要口令"处理。写 tool 可以额外声明
`anonymousWriteWhen(args)` 作为匿名例外（目前只有 `run_batch` 的 `dry_run=true`）。自检脚本：
`npm run test:mcp-annotations`；handler 的第二个参数 `context`（`{ anonymous }`）目前只有写 tool 会读。

## 批量处理并发约定

对多条数据（比如一批邮件）做批量处理时，统一用 [`lib/shared/concurrency.ts`](lib/shared/concurrency.ts) 导出的 `mapWithConcurrencyLimit(items, fn, { concurrency })`，不要自己写 `Promise.all` 一次性全部并发，也不要写 `for...of` 里 `await` 一个个排队。它会控制同时最多跑几个、并把每条失败的错误单独收集起来而不是让整批一起抛错。详细原因见 CLAUDE.md「高并发与数据同步/冲突处理」。
