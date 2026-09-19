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

一个 `BL_COMPARISON` 邮件需要抽取两次：一次对 SI 附件，一次对 BL 附件，各自得到一个 `ExtractedDocumentFields`。

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

## 环境变量约定

见 [`.env.example`](.env.example)，新增需要的环境变量时同步更新那个文件（不要把真实 key 提交进 git）。

## LLM 调用约定

所有模块都通过 [`lib/llm/index.ts`](lib/llm/index.ts) 导出的 `callLLM(provider, prompt, options)` 调用 LLM，不要在 feature 模块内部直接 import 具体某个 LLM 的 SDK。可用的 `provider` 值见上面的"用哪个模型（provider）"。

**Jev 是例外**：它不生成文本，走 `lib/llm` 导出的另一个函数 `callJev(state, questions)`（实现在 [`lib/llm/jev.ts`](lib/llm/jev.ts)），输入一组 typed question（`noul` 是/否概率 / `choice` 选项 / `score` 打分），返回带 `confidence` 的结构化答案。环境变量是 `TYPESAFE_API_KEY`（选填 `JEV_MODEL`，默认 `jev-latest`），见 [`.env.example`](.env.example)。

## MCP tool 约定

每个 feature 的 `mcp/index.ts` 导出一个 `{ name, description, inputSchema, handler }` 形状的对象，由 `app/core/mcp-server/tools.ts` 统一汇总注册，不要自己在别的地方重复注册。

## 批量处理并发约定

对多条数据（比如一批邮件）做批量处理时，统一用 [`lib/shared/concurrency.ts`](lib/shared/concurrency.ts) 导出的 `mapWithConcurrencyLimit(items, fn, { concurrency })`，不要自己写 `Promise.all` 一次性全部并发，也不要写 `for...of` 里 `await` 一个个排队。它会控制同时最多跑几个、并把每条失败的错误单独收集起来而不是让整批一起抛错。详细原因见 CLAUDE.md「高并发与数据同步/冲突处理」。
