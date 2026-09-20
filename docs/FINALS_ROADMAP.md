# 决赛冲刺手册：评分口径、后端缺口与执行顺序（2026-09-20）

来源：① 官方初赛/决赛评分细则 Google Docs（2026-09-20 抓取全文，链接见文末证据索引）；② 官方题目包内的数据生成器与评分脚本（只读分析）；③ 两次隔离 agent 调研报告；④ 本仓库现状核验（含 1 处 bug 的亲自复验）。文中标注【官方原文】【已核实】【推断】。

---

## 1. 初赛评分细则（决定进 10 强）

总分 100 = 技术 70 + 产品与影响力 30。最大单项是 **Working Core Prototype 25 分**。

| # | 细项 | 分 | "Excellent" 档要点（官方原文意译） |
|---|---|---|---|
| 1 | System Design & Architecture | 15 | 架构连贯、有理有据，并被原型或其他技术证据支撑 |
| 2 | Working Core Prototype | 25 | 核心流程可靠地端到端跑通，清楚证明主要技术想法已经建成 |
| 3 | Technology Integration | 15 | 技术选型合理、深度无缝集成，把工具用到极致，有技术手艺感 |
| 4 | Technical Feasibility & Validation | 15 | 关键假设都有清晰证据验证，且有用可信的路径把项目做完 |
| 5 | Problem Statement Understanding | 10 | 对问题、受影响用户、为什么重要有强证据支撑的理解 |
| 6 | Innovation & Solution Approach | 10 | 方案原创、有理由、相比常见做法有明确优势 |
| 7 | Practical Value & Potential | 10 | 强实用价值 + 可信的推广/落地路径 |

评分说明原文要点：所有七项独立打分、整数分；**不得同一证据重复得分**；"分数基于**展示出来、提交了、或清楚解释过**的内容"。

## 2. 决赛评分细则（决定夺冠）

总分 100 = 技术 70 + 产品与影响力 30。最大单项变成 **End-to-End Functionality 25 分**。

| # | 细项 | 分 | "Excellent" 档要点（官方原文意译） |
|---|---|---|---|
| 1 | End-to-End Functionality | 25 | 成品能可靠地端到端跑通，主要功能与集成按预期工作 |
| 2 | Architecture & Scalability | 15 | 架构有充分理由、权衡清楚，有现实的扩展路径并被实现支撑 |
| 3 | Technology Integration | 15 | 同初赛第 3 项（**标注 provisional，等赞助商对齐后可能调整**） |
| 4 | Engineering Quality & Robustness | 15 | 测试充分、可靠、能恰当处理失败；安全与性能被考虑，工程纪律强 |
| 5 | Solution Effectiveness & User Value | 10 | 问题-方案高度契合，有证据表明成品提供了真实价值 |
| 6 | User Experience & Differentiation | 10 | 易用与差异化**两者同等重要**；打磨过、直观、有明确差异化 |
| 7 | Impact & Future Potential | 10 | 有可信的采纳/增长路径，且有**衡量成功的清晰指标** |

## 3. 关键解读（对策略的含义）

1. **初赛看"做通了"，决赛看"成品可靠 + 工程严谨 + 能落地"。** 我们当前状态（520/520 端到端、三入口部署、架构文档齐全）在初赛 rubric 下是 19~25 档的原型 + 12~15 档的架构/集成/验证；决赛 rubric 下真正要补的是 **Engineering Quality & Robustness 15**（测试证据）和 **UX & Differentiation 10**（人工闭环/差异化）。
2. **证据要被"展示/提交/解释"才得分。** slides 和 5 分钟视频应按 rubric 七条逐条摆证据（架构图、数据流、评测数字、错误处理演示、未来路径），不做"重复同一证据拿两次分"的堆砌。
3. **决赛实测形式（推断，证据链如下）**：官方题目包里有数据生成器 `data_v2/generate.py`，其 README 明说 `--seed 42` 且 "Change the seed for a fresh draw"；官方评分脚本 `server/scoring.py` 的权重是 **50% 端到端 + 30% 分类 macro-F1 + 20% 缺陷字段 F1**（NEEDS_REVIEW 只算诊断性 reliability，不加权）。据此推断：决赛"没见过的邮件"极可能是**同生成器换 seed 的新抽样**。
4. **由此得出最高 ROI 动作：多种子回归**——用官方生成器造 3~5 个新 seed 的数据，按官方 `scoring.py` 的四轴口径在自己机器上提前"决赛实测"。这一步同时是初赛第 4 项（Feasibility & Validation）的直接证据。
5. **不要给数字字段加容差**（推断依据：题目包的缺陷注入逻辑是换实体或集装箱 ±1/±2、重量 ±500~2000kg，容差会直接漏检官方差异）。
6. **OCR 不要默认开**：官方对扫描件/坏文件的期望就是 NEEDS_REVIEW；OCR 改判反而伤害 reliability，只能做"演示模式"（默认关闭、只读预览、不改官方结果路径）。

## 4. 已核实的后端缺口

### 4.1 已亲手复验的 bug：空白占位符未被识别（最高优先）

- 事实：`app/features/extraction/logic/label-parser.ts:47` 的 `PLACEHOLDER_VALUE = /^[_\-\s.]*$|^(tba|n\/?a|null|—|-)$/i` 不识别 `???`、`TBC`、`____MT`。
- 我本人复验（2026-09-20，`npx tsx` 直调解析器）：

  ```
  "???"     -> {"shipper":"???"}
  "TBC"     -> {"shipper":"TBC"}
  "____MT"  -> {"shipper":"____MT"}
  "TBA" -> {}   "N/A" -> {}   "" -> {}   ← 这几个正常
  ```

- 官方边界样本池 `edgecases.py` 的 `BLANK_TOKENS = ["???", "_______", "TBA", "TBC", "", "N/A", "____MT"]`。
- 影响（推断）：换 seed 后若 `???`/`TBC`/`____MT` 落在**文本字段**上，我们不会判 `missing_value`（NEEDS_REVIEW），而会当成真值参与比对 → 产出**假 MISMATCH**。对官方 50% 端到端分是直接损失。
- 修法：扩展占位符正则（只含标点/下划线一律视为空 + 枚举 tbc/nil/none）；同步抽取 prompt 反例、`docs/DECISION_SPEC.md`；bump `lib/shared/versions.ts` 的 `PIPELINE_LOGIC_VERSION`；重跑全量评测。工作量 1~2h。

### 4.2 A 档：决赛前值得做的低风险增强（≤4h/项，不碰 `ui/`）

| 编号 | 名称 | 解决什么 | 对评分的作用 | 工作量 | 风险 |
|---|---|---|---|---|---|
| A1 | 空白 token 加固 | 假 MISMATCH 风险（见 4.1） | 初赛验证 / 决赛 e2e | 1~2h | 极低 |
| A2 | 多种子回归评测 | 现在只验过 seed 42 一份数据；提前做"决赛实测" | 初赛 Feasibility / 决赛 e2e 与 Robustness | 3~4h | 低（需 Python 环境，生成目录放仓库外） |
| A3 | 抽取兜底 prompt 加固 | 规则漏抽时 LLM 兜底质量（null 语义、逐字复制要求） | 决赛 e2e / Robustness | 1~2h | 低（需 bump 缓存版本） |
| A4 | KPI / STP 直通率统计 | 评审问"自动化率多少、省多少人工"没有数字 | 产品：Effectiveness / Impact（需要指标） | 2~3h | 低（改接口需同步 SHARED_INTERFACES） |
| A5 | 导出附 `decided_by` | 官方评分脚本会统计并展示规则占比（`rule_pct`），我们导出缺这个字段 | 技术整合叙事"规则+AI 混合"直接可见 | 0.5~1h | 极低 |
| A6 | 人工复核写回（最小闭环） | 官方要求"拿不准提示人工"，现在只能看、不能确认/更正/留痕 | 决赛 UX & Differentiation / Effectiveness | 3~4h | 中（需新建 append-only 表 `review_actions`；需操作者确认） |

### 4.3 B 档：决赛演示用的大招（展示性强、须控风险）

| 编号 | 名称 | 工作量 | 说明 |
|---|---|---|---|
| B1 | Gmail 只读摄取（手动触发） | 6~10h | 痛点第一名"2000 封/天找邮件"的真实演绎；OAuth 配置与隐私风险要提前演练，现场失败需预置数据兜底 |
| B2 | 扫描件 OCR（演示模式，默认关） | 4~6h | 只作建议值/预览，**不得改写 unreadable 判定**（见 3.6） |
| B3 | 运行审计（`pipeline_runs` + 复核留痕） | 3~4h | 决赛 Architecture & Scalability / Robustness 的证据 |
| B4 | DCSA eBL 3.0 字段映射导出 | 2~3h | Roadmap 素材；**不能宣称"已集成"** |
| B5 | `.eml` / `.msg` 解析 | 4~6h | 防决赛给真实 Outlook 样本（场景 B 兜底） |
| B6 | 多语言/港口别名归一（UN/LOCODE） | 2~4h | 差异化加分；官方实测集以英文为主，别挤占主流程 |
| B7 | 本地决策模型 Laya 适配（**只留接口，见 4.3.1**） | 文档 0.5h / 实现 1.5~2 天 | 评估结论：暂不实现；扩展点已记录，将来做是"加文件"不是"改架构" |

### 4.3.1 本地决策模型 Laya：评估结论与预留接口

**结论：这次不做，只记录接口位置。**

- 动机"本地跑、省 API 消耗"不成立：规则优先设计让样批 520 封只产生 ≈50 次 LLM 调用（Jev 计价 $0.042/1M tokens，整批成本≈几分钱）；且分类规则已覆盖 520/520，兜底调用本就极少。
- 它是**非生成式决策模型**（`choice`/`score`/`noul` 三类打分类问题，一次前向 ~33ms、永不生成文本），**做不了抽取**（字段抽取的"本地省 API"已由 LM Studio provider 覆盖）。零样本在自定义决策上接近随机（官方自述 0.362 acc，随机 0.318、多数类 0.461），需在自有数据上微调 + 温度校准才可信——当前团队最低性价比项。
- 事实档案：Apache 2.0，三 checkpoint（英文 421M ctx512 / multilingual 322M ctx1024 / typed-decisions），`pip install laya`，CPU 可跑；链接见 §7。
- **同类别参照物是 Jev**：`lib/llm/index.ts:27-40` 已把"文本生成类 provider"（`TEXT_PROVIDER_IDS`）与决策模型分开，注释明确 Jev 是"结构化决策模型、不生成文本"。Laya 若接入，照 `lib/llm/jev.ts` 的样式走：
  1. 新增 `lib/llm/laya.ts`：HTTP 调本地 Python 服务（`pip install laya` + FastAPI 包装，只暴露 choice/noul）；
  2. `lib/llm/index.ts` 增加 provider 位（建议 id `laya`；非 Vercel 可用，语义同 lmstudio 的 `cloudOnly`），`isProviderConfigured` 用 `LAYA_BASE_URL` 是否配置 + `isLocalLLMAvailable()` 判断，Vercel 上给可读 503；
  3. `app/features/classification/logic/index.ts` 增加 `engine: "laya"` 分支（现有 rules/jev/llm/degraded）；
  4. `docker-compose.yml` 增加独立 service（默认不启用的 profile），主 Docker 镜像不受影响；
  5. `.env.example` 增加 `LAYA_BASE_URL` 注释项；不碰 `ui/`、不碰现有 5 个 provider 的对外契约。
- **为什么不在代码里放占位 stub**：`AGENTS.md` 禁止"为还不存在的假设性需求预先设计接口"、禁止为假设需求加死代码；"留接口"落在本文档——接入点、命名、门控条件写死记清楚，将来实施时是"加文件"而不是"改架构"。

### 4.4 C 档：明确不要做

- 数字字段加容差（会漏检）、默认 OCR 参与正式比对、微调模型/向量库/RAG、把 extraction 拆 Python 微服务（除非 B2/B5 落地）、完整 EDI/DCSA 平台对接、多租户 OAuth 轮询、把生成器 ground truth 当提交分母或按 email_id 硬编码答案。

## 5. 建议执行顺序

| 时间 | 做什么 | 对应分值 |
|---|---|---|
| 9/20~9/21 | **提交材料优先**（视频/幻灯片/提交人，队友B主责）；代码只做 A1 必修 + A5（合计 ≤3h）+ A3（可选） | 初赛全项 |
| 9/22 上午 | 提交前 2~3 小时：手机+无痕窗口三入口冒烟；12:00 前提交 | 初赛材料完整性 |
| 9/23~9/25 | A2 多种子回归 → 按暴露问题修 → A6+B3 人工闭环与审计 → A4 KPI；9/25 晚冻结核心逻辑，只准备演示 | 决赛 25+15+15+10 |
| 9/26 | 决赛路演（10 分钟 + 5 分钟问答）；slides 按 rubrics 七条逐条对证据 | 决赛全项 |

## 6. 待操作者确认

1. 本机是否允许安装 Python 依赖（`openpyxl` / `python-docx` / `reportlab` / `Pillow`）以运行官方生成器？（A2 前置）
2. 是否允许在 Supabase 新建一张 `review_actions` 表（append-only，含 `updated_at`）？（A6/B3 前置）
3. 决赛实测的确切形式（现场打开我们的 Web/MCP，还是评委拿数据自己跑）？（决定 A2 是否要覆盖 REST 入口、B5 的优先级）

## 7. 证据索引

- 初赛评分细则（官方 Google Doc）：https://docs.google.com/document/d/1EiI_mqJYeMN0D-dtZ_npCavVGXVcePFmcZ7O4d4ygQI/edit
- 决赛评分细则（官方 Google Doc，Technology Integration 标注 provisional）：https://docs.google.com/document/d/1S-bLf45JOabMl1QUDgl4F6NTwuwD7UKbhPKh74sqaRo/edit
- 日程（Participant Infopack）：初赛截止 9/22 12:00pm；10 强筛选 9/23 12:00pm；公布 9/24；**决赛路演 9/26**（Monash University Malaysia）
- 官方题目包内：`data_v2/generate.py`（`--seed`）、`data_v2/README.md`（"Change the seed for a fresh draw"）、`server/scoring.py`（50/30/20 权重与 reliability 诊断）、`edgecases.py`（`BLANK_TOKENS`）、`shipment.py`（缺陷注入）、`pools.py`（标签/实体池）
- Laya 模型评估来源：https://huggingface.co/convaiinnovations/laya （子 checkpoint：`laya-multilingual` / `laya-typed-decisions`）
- 本仓库对应实现：`app/features/extraction/logic/label-parser.ts:47`、`app/features/extraction/logic/index.ts:118`、`lib/shared/pipeline.ts`、`scripts/evaluate.ts:32-40`、`app/features/results/logic/stats.ts`、`app/features/results/logic/export/json.ts`、`app/features/mail/logic/gmail.ts`（占位）

## 8. 操作者决议与后端进展（2026-09-21）

- **搁置项（进后端计划单，初赛提交后再排）**：
  - A6 人工复核写回（对应白话版 P1-8）：等初赛提交后再做。
  - 扰动测试 + 风险文档（对应白话版 P1-10）：等初赛提交后再做。
- **本轮已交付（后端，详见 DECISION_LOG 决策 25~29 与 UI_HANDOFF §7）**：
  - P0-2 / P1-5 / P1-9：分类与比对的失败降级链（逐级 fallback）+ `degraded` 标记 + `retry_failed` 一键重试
  - P0-3：附件配对内容兜底（关键词规则 → 规则判不出才 LLM）
  - P0-4：导出格式校验（`X-Export-Invalid` / `X-Export-Invalid-Ids`）
  - P1-6：冲突数值搜索（`numeric_mode` / `tolerance` / `value_field` / `value`，只影响查询）
  - P1-7：字段级出处落库（`evidence_si` / `evidence_bl`，`scripts/phase3-evidence-migration.sql`）
- **验证**：typecheck 通过；MCP 注解自检 11 tools 通过；全量评测 520/520 完全一致（缺陷 TP=72 / FP=0 / FN=0，复核原因 20/20）；Supabase 迁移已应用并核实视图列。
