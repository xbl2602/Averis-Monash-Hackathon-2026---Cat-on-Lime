# docs 目录总览（唯一入口）

> 这是 `docs/` 的目录页：说明**哪份文档现在有效、哪份是历史、遇到问题该翻哪本**。
> 规则：新增文档前先问"能不能并入已有文档"；能并入就并入，不能才新建，并且**必须在这里登记一行**。
> 最后整理：2026-09-21。

## 先看这里：我要找什么？

| 我想知道 | 打开这份 |
|---|---|
| **现在还有什么没做完（待办清单）** | **[TODO.md](TODO.md)** |
| 怎么装、怎么跑、怎么部署（本地 / Docker / Vercel） | 仓库根目录 [README.md](../README.md) |
| 要做/改界面（GUI），接口哪些能接 | **[UI_GUIDE.md](UI_GUIDE.md)** ← 做界面的唯一入口 |
| 某个接口的字段 / 参数 / 返回 / 错误码 | [SHARED_INTERFACES.md](SHARED_INTERFACES.md) |
| 数据在模块之间怎么流动（硬规则） | [DATA_FLOW.md](DATA_FLOW.md) |
| 分类 / 抽取 / 比对到底怎么判、模型输入是什么 | [DECISION_SPEC.md](DECISION_SPEC.md) |
| 某条设计"当时为什么这么定" | [DECISION_LOG.md](DECISION_LOG.md) |
| 团队怎么分工、Git 怎么用、AI 协作规则 | [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md)（约束性规则在根目录 [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md)） |
| 题目背景、评分细则、赛程 | [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md) + [official/](official/) |
| 决赛要做什么、还差什么 | [FINALS_ROADMAP.md](FINALS_ROADMAP.md) |
| 以前的合并记录 / 会议纪要 / 审计 | [HISTORY.md](HISTORY.md)（只读历史） |

## 全部文档一览

### A. 现在有效 · 权威（改代码/接口时要同步更新）

| 文档 | 一句话 | 维护状态 |
|---|---|---|
| [SHARED_INTERFACES.md](SHARED_INTERFACES.md) | 接口契约：路径、参数、返回、错误码 | 权威；改接口同一提交更新 |
| [DATA_FLOW.md](DATA_FLOW.md) | 数据怎么在模块间流动的硬性规则 | 权威 |
| [DECISION_SPEC.md](DECISION_SPEC.md) | 分类/抽取/比对的判定标准与模型输入契约 | 权威 |
| [DECISION_LOG.md](DECISION_LOG.md) | 逐条决策记录（含"为什么不那样做"） | 权威；只追加不改旧条目 |
| [UI_GUIDE.md](UI_GUIDE.md) | GUI 开发指南（就绪接口速查 + 界面改动清单） | 权威；接口变化时同步 |

### B. 现在有效 · 计划与背景

| 文档 | 一句话 | 维护状态 |
|---|---|---|
| [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md) | 团队手册：分工、时间线、Git、协作方式 | 视计划变化更新 |
| [FINALS_ROADMAP.md](FINALS_ROADMAP.md) | 决赛冲刺计划与缺口清单 | 视计划变化更新 |
| [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md) | 题目背景、评分理解、赛程 | 背景，基本不改 |
| [PHASE2_SPEC.md](PHASE2_SPEC.md) | config / mail / import 三块的设计说明 | ✅ 2026-09-21 已同步文档差异（原 UI_GUIDE §6 清单已修完） |
| [REVIEW_SPEC.md](REVIEW_SPEC.md) | 人工复核闭环（复核队列 / 落库 / 撤销 / 审计）的设计规范 | ✅ 后端（REST+MCP）已实现，四模块都接了；**GUI 未做**（队友A待办，见 UI_GUIDE.md）；实现记录见本文件 §14.1 |

### C. 历史 · 只读（不要再回头改，新记录追加到末尾）

| 文档 | 收录内容 |
|---|---|
| [HISTORY.md](HISTORY.md) | 原 MERGE_NOTES（一次合并记录）+ WORKSHOP_1（云托管 workshop 纪要）+ WORKSHOP_2（Averis 题目答疑纪要）+ COUNCIL_AUDIT_2026-09-21（一次审计快照） |

### D. 官方原文（不要修改）

| 文件 | 说明 |
|---|---|
| [official/Rules and Regulations.md](official/Rules%20and%20Regulations.md) | 官方比赛规则与评分细则（英文原文） |
| [official/Averis Hackathon Participant Infopack.md](official/Averis%20Hackathon%20Participant%20Infopack.md) | 官方参赛信息包（英文原文） |

### E. 其它

| 文件 | 说明 |
|---|---|
| [logo-concepts.html](logo-concepts.html) | 视觉草稿，不是文档 |

## 维护规则（防止文档再次失控）

1. **能并则并**：想写新文档时，先看能不能并入上面 A/B/C 里已有的某一份。
2. **每份文档写清身份**：头部标 `维护状态（权威/计划/历史）` + `最后核对日期`。
3. **历史只追加**：C 类档不改旧内容；要更新就追加新的一段或新建一份。
4. **契约单一来源**：字段/参数/返回只写在 `SHARED_INTERFACES.md`，别处只放链接，不复制。
5. **本页是唯一入口**：任何新增/改名/归档，都在这里同步一行。
