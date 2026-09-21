# 数据流规划

> 数据该怎么流动，是提前设计好的，不是"哪里方便就从哪里接一根线"。
> 这份文件定义"数据从哪来、经过谁、到哪去"，是硬性规则，跟 [CLAUDE.md](../CLAUDE.md) 同级——
> 写代码前先看这份文件，确认自己的改动没有破坏这条流水线。

## 核心原则

**数据流必须是一条单向、可追踪的"管道"，不能是网状的、谁跟谁都能互相调用的结构。**

打个比方：这应该像自来水管——水从水源经过一道道处理，最后流到水龙头，每一段接口在哪清清楚楚，出问题了顺着管子就能查到是哪一段坏的。不能是"哪里方便就从旁边接根水管过去"，那样水管越接越乱，一处漏水全网跟着遭殃，也没人说得清水到底是怎么流过来的。

## 整体数据流（从一封邮件到最终提交结果）

```
官方样例数据 (data/sample/，以后可能换成官方API)
        │
        ▼
[classification 模块] 判断邮件类型 → category
        │
        │  只有 category === "BL_COMPARISON" 才继续往下走
        │  （其他类型到这里就结束了，不需要抽取/比对）
        ▼
[extraction 模块] 分别对 SI 附件、BL 附件各抽一次字段
        │  （两次调用，一次给SI文本，一次给BL文本，互不干扰）
        ▼
[comparison 模块] 对比两组字段 → status / defect_fields / has_defect / review_reason
        │
        ▼
组装成一条 EmailVerificationResult（一封邮件对应一条结果）
        │
        ▼
汇总成 { email_id: EmailVerificationResult, ... } 这个大文件
        │
        ▼
交给官方评分系统（docker /submit 或 score_cli.py）
```

这条流水线的**方向是固定的**：分类 → 抽取 → 比对 → 组装。没有反向箭头，没有"比对模块回头去改分类结果"这种事。

## 数据流规则（禁止事项——防止变成"网状乱流通"）

1. **模块之间不能互相直接调用对方的 `logic`**。`classification` 的代码不能 import `extraction` 内部的函数，反过来也不行。三个模块只通过"数据"打交道，不通过"直接调代码"打交道——上一个模块的输出，是下一个模块的输入，中间由"编排层"（见下面）负责传递，不是模块自己伸手去找别人要数据。
2. **UI 不能抄近道**。网页上的组件（`ui/`）只能调用同一个模块自己的 `api/`，不能在网页代码里直接 import LLM 的 SDK、直接查数据库、或者直接调别的模块的东西。
3. **跨模块传递的数据，格式只能用 `lib/shared/types.ts` 里定义好的类型**，不能自己在某个模块里临时发明一个新字段名，然后口头告诉队友"记得用这个格式"——口头约定就是典型的"就近乱接线"，必须是代码里真的 import 那个类型，不是各自抄一遍。
4. **同一件事的"标准答案"只能在一个地方定义**。比如"要比对哪7个字段"这件事，只在 `lib/shared/types.ts` 的 `COMPARED_FIELDS` 里出现一次，其他地方都是引用它，不能每个模块自己再写一份字段名列表——写两份，以后改一个忘了改另一个，两边就会对不上，出现很难查的bug。

## 编排层（pipeline）：已就位

`lib/shared/pipeline.ts` 是**唯一**知道"先分类、再抽取、最后比对"这个顺序的地方：

- `runEmailPipeline`：跑一封邮件 → 组装成 `EmailVerificationResult`，并负责 5 种"拿不准"的判定（缺附件 / 类型不对 / 读不了 / 字段缺失 / 分类没把握）
- `runBatchPipeline`：批量处理，用 `mapWithConcurrencyLimit` 限量并发；单封失败单独记录，不拖垮整批
- `computeInputHash` + `PIPELINE_LOGIC_VERSION`：结果层增量跳过的依据（内容没变、引擎版本没变就不重算）

网页、REST API、MCP 要"跑一封/一整箱"都应该调用这里，不要在别处重新拼顺序逻辑。
引擎是混合模式（规则优先，拿不准/有矛盾才调模型），所有模型调用走 `lib/shared/llm-cache.ts` 的内容指纹缓存；本地全量评测用 `npm run evaluate`（对照 ground_truth 自测，官方已澄清允许）。
模型环节失败按"逐级降级"处理（2026-09-21，决策 25）：分类 = 规则 → Jev → 文本 provider 链 → 尽力规则（`degraded`）；比对 = 规范化精确比 + Jev 复核，Jev 失败转保守口径（`rules-degraded`）；`retry_failed` 可一键重算这些邮件。
字段级出处（规则命中的行号 + 原句）随抽取结果一起流到结果层（`evidence_si` / `evidence_bl`，决策 29）；LLM 兜底的字段只标来源、没有行号。

## 结果查询（results 模块）：只读分支

`app/features/results/` 是这条管道的**只读出口**，不参与生产：按分类/状态/处理情况查结果、
排序分组、统计、列冲突文件对、导出（json/md/txt/官方提交格式）。它和网页、REST、MCP 的关系：

```
verification_results（结果层）
        │  只读（通过 verification_overview 视图）
        ▼
[results 模块 logic] ── 同一套实现 ──┬── REST /features/results/api/*
                                     └── MCP tools（list_results / get_stats / list_conflicts / export_results）
```

规则：results 模块**只读**，不写任何表；别的模块也不要自己去查 `verification_overview`
或拼相同的查询——要数据就走 results 的 logic（接口格式见 SHARED_INTERFACES.md）。

**例外（P1-1 人工复核闭环，2026-09-21）**：`scope=submission` 导出会额外读 `review_overrides`
（通过 `lib/shared/review/merge.ts` 的 `applyOverridesToSubmission`，不是 results 模块自己拼查询，
是调公共区 `lib/shared/review/` 提供的函数），把人工复核结论叠加到系统结果之上再输出。这是唯一
一处"结果查询之外还读别的表"的地方，因为它就是导出链路本身的一部分，不算破坏"results 只读查询"
的边界——`review_overrides`/`review_actions` 两张表的写入完全由 `lib/shared/review/` 负责，
四个 feature 模块（classification/extraction/comparison/pipeline）各自的 `api/review/*` 只是薄层转发。

## 评委自带文档测试（sandbox 模块）：完全不进这条管道

`app/features/sandbox/` 是唯一一个**不碰 Supabase 任何一张表**的模块——它接收上传的 SI/BL 文件内容，
直接调用 classification/extraction/comparison 各自的 `logic/`（和 `pipeline.ts` 一样是编排层，只是
输入来自请求体而不是 `data/sample/`），结果算完直接返回，不落 `verification_results`、不进
`raw_emails`/`parsed_attachments`。这是有意设计：这个模块的目的是"临时测一次、不留痕迹"，
不应该污染正式的结果表或参与统计/导出。

## ⚠️ 开发者模式（devmode）：唯一一个允许绕过下面所有"谁能写"规则的地方

`app/features/devmode/` 不是这条管道的一部分，是给团队/评委在验证阶段用的运维工具——它能直接
清空/重建下表列出的**全部**数据表，绕开"只有导入脚本/评测脚本/review store 能写"这些平时的
边界。这是有意的例外，不是设计漏洞：详见 [`DECISION_LOG.md`](DECISION_LOG.md) 决策34、
[`SHARED_INTERFACES.md`](SHARED_INTERFACES.md)「开发者模式」一节。约束：不注册 MCP tool、
写操作需要 `x-admin-token` + 请求体里逐字匹配的确认短语两道门槛、不碰 `app_config`/
`mail_accounts`/`supabase_projects` 这三张连接配置表。

## 数据的"读/写"边界

| 数据 | 谁能读 | 谁能写 |
|---|---|---|
| `data/sample/`（官方样例邮件） | 所有模块 | 任何代码都不应该修改它——这是官方给的原始数据，改了就对不上了 |
| `lib/shared/types.ts`（字段/格式定义） | 所有模块 | 改动前必须先跟操作者确认，这是"公共区"，改错了三个模块都受影响 |
| Supabase（`raw_emails` 原始层 / `parsed_attachments` 文字层 / `verification_results` 结果层 / 只读视图 `verification_overview`，另有内部缓存 `llm_call_cache`） | 前三张表和视图对所有模块、UI、预览开放读（RLS 公开只读）；结果查询统一走 `verification_overview` 视图（results 模块实现），不要各自拼两张表；`llm_call_cache` 只有服务端能读写 | `raw_emails`、`parsed_attachments` 只由本地导入脚本 `npm run import:data` 增量写（按指纹跳过没变的内容；upsert 冲突键 `email_id` / `email_id,file_path`）；`verification_results` 由本地评测 `npm run evaluate` 按 `email_id` upsert 写（单封失败标 `processing_status='failed'`）。不要在别的代码里零散写这些表；表结构和指纹规则见 SHARED_INTERFACES.md「数据库存储层」。**唯一例外：`app/features/devmode/` 可以整表删除/重新导入（见上一节）** |
| Supabase（`review_overrides` 人工覆盖 / `review_actions` 审计日志，P1-1） | 对所有模块、UI 开放读（RLS 公开只读） | 只由 `lib/shared/review/store.ts` 写（四模块的 `api/review/*` 都调这一份，不各自拼 SQL）；`review_overrides` 按 `(target_kind,email_id)` upsert，`review_actions` 只 insert（append-only）；DDL 见 `scripts/review-schema.sql`。**唯一例外：`app/features/devmode/` 可以整表清空（见上一节）** |
| 环境变量 | 只用来配置"怎么连外部服务"（LLM key、Supabase地址） | 不要把业务数据（邮件内容、比对结果）塞进环境变量里，那是配置，不是数据 |

## 为什么要这么严格

团队3人同时用各自的AI并行开发，如果数据"哪里方便就从哪流"，很快会出现：改了 classification 的输出格式，结果 extraction 那边毫无察觉地跟着坏掉，但因为两边代码是"直接互相调用/口头约定"而不是"通过统一类型定义"，排查起来根本不知道问题出在哪一环——这正是本文件开头说的"一张网"式混乱的真实后果。管道式设计的好处是：出问题时，顺着"分类→抽取→比对"这条固定路径查，永远知道该去哪一环找错。
