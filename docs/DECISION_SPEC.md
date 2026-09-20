# 判定规范（DECISION_SPEC）

> **这份文件是什么**：分类 / 抽取 / 比对三个模块里**每一个判断点**的权威定义——选项和定义、程序判定标准、模型判定标准、发给模型的扁平输入、优先级顺序、阈值、输出映射。
> **强制**：代码改动如果影响这里任何一条（选项、定义、提示词、阈值、输入字段），必须**同步更新本文件**，并重跑 `npm run evaluate -- --no-write` 确认仍 520/520（见 §7）。
> 相关：[DATA_FLOW.md](DATA_FLOW.md)（模块间数据流）、[SHARED_INTERFACES.md](SHARED_INTERFACES.md)（对外接口）、[DECISION_LOG.md](DECISION_LOG.md)（历史决策原因）。

## 1. 总原则

1. **程序优先，模型兜底**：能用确定性代码判定的判断一律走程序（不花 token、结果稳定、可回归）；只有规则"明确判不了"时才调模型。
   - 分类：52 条高精度签名 + 打分（2026-09-20 强制全量重跑实测 520/520 全走程序，Jev 只兜底规则判不了的新邮件）
   - 抽取：标签规则（样例 237/242 可读文档完整抽出；明显非 SI/BL 直接 OTHER，不进模型）
   - 比对：规范化精确比；数字字段永远程序判；只有"文字字段候选差异"才交给 Jev
2. **模型输入必须扁平**：发给 Jev / LLM 的载荷只能是**单层、纯文本、必要字段**——绝不允许整个邮件对象、附件清单、数据库行、嵌套结构。
3. **两个"扁平化"是两件事**（容易混淆，明确区分）：
   - **结构扁平化**（发模型用）：只挑必要字段、单层字符串 —— 每个调用点的具体形状见 §2.3 / §2.4 / §3.3 / §4.2 / §6。
   - **文本规范化 `normalizeText`**（`lib/shared/normalize.ts`）：小写 / 空白折叠 / 全角转半角 —— **只用于程序比较和检索，禁止把规范化后的文本喂给模型**（会丢信息、降低抽取质量；normalize.ts 文件头有同样警告）。
4. **统一阈值 0.85**：Jev 分类 confidence < 0.85 → `needs_review=true`；Jev 字段一致概率 noul < 0.85 → 记为差异。不要单独改动某处阈值。
5. **调用约定**：`callLLM` / `callJev` 统一 20s 超时、不重试、错误归一化（缺 key → 可读配置错误；上游故障 → 稳定 code，不透传原文）；所有结果写 `llm_call_cache`（键 = 用途 + 引擎版本 + provider + 模型 + 发送内容），输入不变不重复调用。

## 2. 分类（classification）

### 2.1 选项与定义

唯一来源 `lib/shared/types.ts` 的 `EMAIL_CATEGORIES`；定义在 `logic/index.ts` 的 `CATEGORY_DEFINITIONS`。

| 选项 | 定义 |
|---|---|
| BL_COMPARISON | 发来提单(BL)草稿并要求核对/确认其与装运指示(SI)是否一致 |
| SI_REQUEST | 发来或索取装运指示(SI / Shipping Instruction) |
| INVOICE_QUERY | 询问发票、费用、付款相关的事宜 |
| GENERAL | 其他正常航运业务往来，不属于上面几类，也不是垃圾邮件 |
| SPAM | 广告、钓鱼或与航运业务无关的垃圾邮件 |

这 5 条定义同时用于：Jev choice 的 criteria（§2.3）、文本 LLM prompt（§2.4）。**两处必须逐字一致**。

### 2.2 程序判定标准（`rules.ts`，命中即终局，不调模型）

- 输入：`normalizeText(subject + " " + subject + " " + body)`（主题计两次，权重更高）
- 第一层：52 条签名正则按固定顺序找第一个命中（**顺序有讲究，不可随意重排**）：SPAM 14 条 → GENERAL 14 条（含 "Submit SI & AED"、"Billing process" 等内部通知模板，必须先于 BL/SI/发票检查，避免被误导词带偏）→ BL_COMPARISON 10 条 → SI_REQUEST 7 条 → INVOICE_QUERY 7 条
- 第二层（签名全不中）：词表打分（每类一组关键词，命中的词数累计）→ 只有 `topScore ≥ 1` 且 `与第二名分差 ≥ 2` 才自动下结论
- 都不满足 → 交给模型（§2.3 / §2.4）；本次结果出处的 engine 标记 `rules` / `jev` / `llm`（内部 meta，不改变对外契约）

### 2.3 模型判定①：Jev（拿不准且 `TYPESAFE_API_KEY` 存在时）

- 模型：`JEV_MODEL` 环境变量，默认 `jev-latest`
- **扁平输入（state）**：`{ from, subject, body }` —— 仅 3 个单层字符串（不发 attachments、不发元数据）
- 问题（questions.category）：
  - `type: choice`
  - `instructions: 这封邮件属于哪一类？`
  - `criteria:` 与 §2.1 的 5 条定义逐字一致
- 判定标准：`confidence ≥ 0.85` → 直接采信；`< 0.85` → `needs_review=true`（对应题目第④条"拿不准提示人工"）
- 缓存 purpose：`classification`

### 2.4 模型判定②：文本 LLM（显式指定 provider，或 Jev 不可用时的兜底，默认 gemini）

prompt 原文（`logic/index.ts`）：

```
请判断下面这封航运邮件属于哪一类，只回答类别代号本身，不要解释、不要加标点或其它文字。

可选类别：
- BL_COMPARISON: 发来提单(BL)草稿并要求核对/确认其与装运指示(SI)是否一致
- SI_REQUEST: 发来或索取装运指示(SI / Shipping Instruction)
- INVOICE_QUERY: 询问发票、费用、付款相关的事宜
- GENERAL: 其他正常航运业务往来，不属于上面几类，也不是垃圾邮件
- SPAM: 广告、钓鱼或与航运业务无关的垃圾邮件

邮件：
From: {from}
Subject: {subject}
Body:
{body}
```

- **扁平输入**：prompt 内只有 From / Subject / Body 三个字段（内容来自 §2.3 同一份扁平结构）
- 判定标准：响应文本里必须能匹配到某个类别代号（大小写不敏感），否则抛错（不猜）
- 缓存 purpose：`classification_llm`

### 2.5 输出映射

`category`（必填）+ `confidence`（仅 Jev 路径有，程序路径为 null）+ `needs_review`（仅 Jev 置信度可触发）

## 3. 抽取（extraction）

### 3.1 字段与定义

唯一来源 `lib/shared/types.ts` 的 `COMPARED_FIELDS`，共 7 个：shipper / consignee / notify_party / port_of_loading / port_of_discharge / container_count / gross_weight_kg。
要求**按含义对齐**，不按原文字段名——同一字段在不同单据上的写法不同。

### 3.2 程序判定标准（`label-parser.ts`，先于模型）

1. `isLikelyOtherDocument`（`lib/shared/document-identify.ts`）：命中 `commercial invoice | packing list | certificate of origin` → `document_type=OTHER`、`fields={}`、**不调模型**（上层据此判 wrong_doc_type）
2. 标签规则解析（覆盖 txt / xlsx / docx / 文字层 PDF 的全部样例版式）：

| 字段 | 标签变体（NFKC + 小写后从行首匹配） |
|---|---|
| shipper | `^shipper(/exporter)?` |
| consignee | `^consignee`、`^to the order of`（提单常见） |
| notify_party | `^notify( party)?` |
| port_of_loading | `^port of loading`、`^pol`、`^load(ing) port` |
| port_of_discharge | `^port of discharge`、`^pod`、`^discharge port` |
| container_count | `^container count`、`^total containers?`、`^no. of containers?( or packages)?`、`^containers` |
| gross_weight_kg | `^(total )?gross\s*(wt|weight)\w*`（`\w*` 兼容样例的 Weightnn 印刷变体） |

   值可在标签同行（txt/xlsx），也可在后续行（docx/pdf）：组织名类只取 1 行（防地址污染），其余最多 3 行；遇到下一节标题（STOP_LINE）或分隔线即停止收集
3. 值校验（防误采）：清理空白/标点后必须非空、不是占位符（`TBA / N/A / null / 空 / — / ____` 等，正则 `PLACEHOLDER_VALUE`）、通过字段校验（container_count 必须形如 `数字( x 描述)?`；gross_weight_kg 必须是数字 + 可选单位）
4. 7 字段全部抽到 → 直接返回，不调模型

### 3.3 模型判定：LLM 兜底（仅有字段缺失时；默认 gemini）

prompt 原文（`logic/index.ts`）：

```
你是航运单证助手。请从下面的 {SI|BL} 文档文本中抽取 7 个字段（按"含义"对齐，不要按原文字段名对齐）。

字段列表：shipper, consignee, notify_party, port_of_loading, port_of_discharge, container_count, gross_weight_kg

规则：
- 只抽取文档里真实存在的值，绝对不要猜测
- 找不到的字段填 null；占位符（如 TBA / N/A / ____MT / 空白）也填 null
- 只输出一个 JSON 对象，不要解释、不要代码块

文档文本：
{documentText}
```

- **扁平输入**：只有 `document_type`（SI/BL，出现在提示句里）+ `document_text`（单一纯文本）——不发文件名、附件列表、元数据
- 判定标准：响应须能解析出 JSON 对象（容忍 ``` 代码块、前后多余文字）；非字符串值丢弃；占位符丢弃
- **合并规则：程序抽到的值优先，LLM 只补缺**（规则值经过校验更可靠）
- 失败降级：LLM 报错或返回不可解析 → 只用规则结果并记日志（缺字段会在上层判 missing_value），不拖垮整批
- 缓存 purpose：`extraction_llm`

## 4. 比对（comparison）

### 4.1 程序判定标准（规范化 + 精确比较；数字字段永不过模型）

先对两侧同字段各自做 `canonicalFieldValue`（`logic/canonical.ts`）：

| 字段 | 规范化规则 |
|---|---|
| shipper / consignee / notify_party | normalizeText → 取 `\|` 前主体名 → 去 `.` `,` → 若 60 字符内出现法律后缀（Pte Ltd / Sdn Bhd / Co Ltd / Limited / LLC / GmbH / FZE / Inc / Company）则截到后缀为止（剥掉地址尾巴） |
| container_count | normalizeText → 去掉空白与 `' ’ " “ ” .` |
| gross_weight_kg | normalizeText → 只留数字 → 去掉前导零（千分位/单位差异不影响） |
| port_of_loading / port_of_discharge | normalizeText |

- 规范化后相同 → 一致；不同 → 候选差异
- **数字字段（container_count / gross_weight_kg）候选即差异，不送 Jev**（实测 Jev 会把 "5 x 20'GP" vs "6 x 20'GP" 判成一样）
- 一边有值一边没有 → 防御性记为差异（正常流程已在上游判 missing_value）
- 没有"文字字段候选差异"或 Jev 不可用 → 文字候选**直接算差异**（保守，不漏报），engine=`rules`

### 4.2 模型判定：Jev 复核文字候选差异（混合模式）

- 模型：`jev-latest`（JEV_MODEL）
- **扁平输入（state）**：`[{ field, si_value, bl_value }, …]` —— 只含候选字段的**原始值**（不是规范化后的值，规范化只用于挑选候选）
- 问题（每个候选字段一个，type=noul）：
  - `instructions: SI 和 BL 的 {field} 指的是同一个东西吗？容忍大小写、空格、标点、表述顺序差异；如果指的对象/地点不同则不是。`
  - `criteria: { true: "含义一致", false: "含义不同或无法确认一致" }`
- 判定标准：`noul ≥ 0.85` → 一致；`< 0.85` → 差异（0.85 是实测校准上限：真实差异最高 0.52、真实一致最低 0.88；调高会开始误报）
- 缓存 purpose：`field_equivalence`
- 显式接口 `provider=jev`（`compareWithJev`）对**全部可比字段**提问，criteria 措辞略有不同：
  `true: "完全相同，或只是格式/大小写/空格不同但含义一致"` / `false: "含义不同，或有一边缺失、无法确认一致"`

### 4.3 输出映射

`status`（OK / MISMATCH / NEEDS_REVIEW）+ `defect_fields`（差异字段清单）+ `has_defect` + `review_reason`（仅 NEEDS_REVIEW 时非空）

## 5. 流水线"拿不准"判定（review_reason，检查顺序固定）

| 顺序 | review_reason | 判定标准（全部程序判定） |
|---|---|---|
| 1 | missing_attachment | 分类为 BL_COMPARISON，但 `_SI` / `_BL` 附件缺任一，且正文承诺了"核对/比对"（正则 `(compare\|check)…(si\|draft bl\|bill of lading)`）；只索取文件（"请把 draft BL 发来"）不算，按 OK |
| 2 | wrong_doc_type | 任一附件被识别为 OTHER（商业发票/装箱单/产地证） |
| 3 | unreadable | 附件解析失败（扫描件/损坏）或抽取返回空 |
| 4 | missing_value | 7 个字段任一在 SI 或 BL 侧缺失（含占位符） |

以上都不触发 → 进入比对（§4），输出 OK / MISMATCH。

## 6. 模型调用点清单（唯一清单；新增调用点必须登记在这里）

| # | 调用点 | 触发条件 | 模型 | 扁平输入 | 输出/判定 | 缓存 purpose |
|---|---|---|---|---|---|---|
| 1 | 分类（Jev） | 签名 + 打分都判不了，且有 `TYPESAFE_API_KEY` | `jev-latest`（JEV_MODEL） | `{ from, subject, body }` | choice；confidence < 0.85 → needs_review | `classification` |
| 2 | 分类（文本兜底） | 显式 provider ≠ jev；或 Jev 不可用 | gemini-3.6-flash（默认）/ claude-sonnet-4-5 / gpt-4o-mini / deepseek-chat / local-model | From / Subject / Body 文本 | 响应必须出现类别代号，否则报错 | `classification_llm` |
| 3 | 抽取（补缺） | 规则缺 ≥ 1 个字段且非 OTHER | `provider ?? gemini` | `{ document_type, document_text }` | JSON；null/占位符丢弃；规则值优先 | `extraction_llm` |
| 4 | 比对（复核） | 存在文字字段候选差异且有 Jev | `jev-latest` | `[{ field, si_value, bl_value }]` | noul < 0.85 → 差异 | `field_equivalence` |

## 7. 改动约定（强制）

1. 改任何**选项 / 定义 / 提示词 / 阈值 / 输入字段**：先改本文件，再改代码，然后 `npm run evaluate -- --no-write` 必须仍 **520/520**（分类 macro-F1 100%、缺陷字段 0 漏报 0 误报）
2. 实质改动引擎逻辑时把 `lib/shared/versions.ts` 的 `PIPELINE_LOGIC_VERSION` +1——缓存键含版本号，不 +1 会混用旧结果
3. 新增模型调用点：必须走 `lib/llm` 统一入口（`callLLM` / `callJev`）、输入扁平、在 §6 登记
4. 顺序敏感项（分类签名顺序、流水线 review 检查顺序）不得重排，除非重跑全量评测并更新本文件
