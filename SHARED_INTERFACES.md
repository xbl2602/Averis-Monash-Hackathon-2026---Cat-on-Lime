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

三个模块的 `api` / `mcp` 都接受一个**可选**参数 `provider`，缺省 `claude`。可选值来自 `lib/llm` 的 `LLM_PROVIDER_IDS`：`claude` / `openai` / `deepseek` / `gemini` / `lmstudio` / `jev`。前端下拉框要列 provider 时，直接用 `lib/llm` 导出的 `LLM_PROVIDERS`，不要自己另写一份清单。

- `jev`（TypeSafe System One 结构化决策模型）**只能做分类/比对**，靠 `callJev()` 调用，不能用于 extraction 那种"写出一段文字"的任务；误用时 `callLLM("jev", ...)` 会抛出可读的错误。
- 该参数只在 `api` / `mcp` 层解析、传给 `logic`；`logic` 里的函数签名是 `{ ..., provider?: LLMProvider }`，默认值由 logic 自己兜底，UI 不传也能正常工作。

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
}
```

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

## 编排层与混合引擎（pipeline）

`lib/shared/pipeline.ts` 是唯一拼"分类 → 抽取 → 比对"顺序的地方：

- `runEmailPipeline`：单封邮件 → `EmailVerificationResult`，同时负责 4 种"拿不准"判定（missing_attachment / wrong_doc_type / unreadable / missing_value）
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
| `verification_results` | 结果层 | `category` / `comparison_status` / `review_reason` / `defect_fields` / `defect_count`（生成列，自动等于 `defect_fields` 的个数）/ `has_defect` / `extracted_si` / `extracted_bl` / `model_provider` / `input_hash` / `logic_version` / `processing_status`（ok / failed）/ `error_message` | 本地评测 `npm run evaluate`、批量入口（`POST /features/pipeline/api` / MCP `run_batch`）：upsert，冲突键 `email_id`；处理失败的邮件也写一行（`processing_status='failed'` + `error_message`），下次重跑会自动重试 |
| `llm_call_cache` | 调用缓存 | `cache_key`（指纹）/ `purpose` / `provider` / `model` / `request_payload` / `response_payload` / `last_used_at` | 服务端缓存层（upsert，不对外开放） |

**指纹（`*_hash`）统一算法**：sha256(该行要存的全部内容做 JSON 序列化)。作用：

- `raw_emails.content_hash` / `parsed_attachments.content_hash`：增量导入时内容没变就跳过
- `verification_results.input_hash` + `logic_version`：增量跑分时输入没变、引擎版本没变就跳过
- `llm_call_cache.cache_key`：模型调用级缓存键（含用途+版本+模型+实际发送内容），输入没变就不重复调用

约定：

- 写入一律 **upsert**（不要"先查存不存在再插"）；`updated_at` 由数据库触发器自动刷新，写入方不用手动设置
- 权限：前三张表"所有人可读（RLS 只开放 select）、只有 service role 能写"；`llm_call_cache` 完全对外关闭（只有 service role 能读写）
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
| `/features/results/api/conflicts` | 冲突文件对（默认 MISMATCH + NEEDS_REVIEW） | `status` `q` `sort_by` `order` `limit` `offset` |
| `/features/results/api/export` | Save as：返回带 `Content-Disposition` 的文件内容 | `scope` `format` + 上面的筛选参数 |

- 多值参数用逗号分隔（`status=MISMATCH,NEEDS_REVIEW`）或同名参数重复；`limit` 默认 50、最大 200
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
`{ email_id, from, subject, si_file, bl_file, other_files, status, review_reason, defect_fields, defect_count, si_values, bl_values, updated_at }`。

### 导出（Save as）

- `scope`：`results`（当前筛选的结果列表）/ `conflicts`（冲突文件对）/ `stats`（统计汇总）/ `submission`（官方提交纯 JSON：`{ email_id: EmailVerificationResult }`，只允许 `format=json`）
- `format`：`json` | `md` | `txt`（json 是结构化数据，md/txt 是给人看的报告，含统计摘要 + 明细）
- 文件名在响应头 `Content-Disposition`；`scope=submission` 时用 `X-Export-Incomplete` 提示是否覆盖了全部 520 封（有失败行或条数不足时为 true）

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
| `limit` | 单次最多跑几封，1~520，默认 50；剩余数量在响应的 `remaining` 里（Vercel 函数上限 60s，大批量分几次调） |
| `force` | true = 忽略增量指纹强制重算，默认 false |
| `dry_run` | true = 只算不写库（不需要 service key），默认 false |
| `provider` | 文本兜底模型，默认 claude；不能用 jev（返回 400） |
| `concurrency` | 同时最多处理几封，1~8，默认 4 |

响应（`RunBatchSummary`）：

```ts
interface RunBatchSummary {
  total_emails: number; selected: number; skipped: number; ran: number;
  succeeded: number; failed: number; wrote: number; remaining: number;
  dry_run: boolean; logic_version: string; duration_ms: number;
  failures: { email_id: string; error: string }[];   // 最多列 20 条
}
```

增量规则：结果表里已有该邮件、`processing_status='ok'`、`input_hash` 和 `logic_version`
都一致的，直接跳过（`skipped`）；上次是 failed 的会自动重跑。写入用 upsert（冲突键
`email_id`），成功的行写 `processing_status='ok'`，失败的行也写
`processing_status='failed'` + `error_message`（不挡其他邮件）。

错误：参数错 400；需要写库但缺 `SUPABASE_SERVICE_ROLE_KEY` 时 503（提示可改用 `dry_run`）；
其余 500。GET 同一个地址返回接口用法说明。

### MCP tool：`run_batch`

参数与 REST 请求体一一对应（snake_case 相同）；注解是 `readOnlyHint: false`
（与查询类 tool 区分），结果就是上面的 `RunBatchSummary`。

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

### 写保护（所有第二阶段写接口共用）

请求头 `x-admin-token: <ADMIN_TOKEN>`；`ADMIN_TOKEN` 未配置时**拒绝所有写操作**（安全默认）。
读取接口全部开放（裁判/访客自由查看）。实现见 [`lib/shared/admin-guard.ts`](lib/shared/admin-guard.ts)。

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

Supabase 客户端解析：**启用项目（`supabase_projects.is_active`） > 环境变量**——写库类代码请用
[`lib/shared/supabase.ts`](lib/shared/supabase.ts) 的 `getSupabaseServiceClientAsync()`（每次现解析现建，
不缓存）；解析管理表本身固定用 env 引导客户端，避免自依赖。现有 `results` / `pipeline` 的写路径
仍走 env 项目（已知限制，升级它们时改用 async 版本即可）。

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
加上原有的 8 个，现在共 11 个 tool。

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

## 批量处理并发约定

对多条数据（比如一批邮件）做批量处理时，统一用 [`lib/shared/concurrency.ts`](lib/shared/concurrency.ts) 导出的 `mapWithConcurrencyLimit(items, fn, { concurrency })`，不要自己写 `Promise.all` 一次性全部并发，也不要写 `for...of` 里 `await` 一个个排队。它会控制同时最多跑几个、并把每条失败的错误单独收集起来而不是让整批一起抛错。详细原因见 CLAUDE.md「高并发与数据同步/冲突处理」。
