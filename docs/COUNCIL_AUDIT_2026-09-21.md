# 审计记录（/council 把关模式 · 2026-09-21）

> 本文是 2026-09-21 全项目审计的整合存档。原始 27 份逐轮报告（round-plan-1~3 / round-diff-1）已删除，结论与遗留项已全部归并到本文。
> 审计方式：6 位评审委员（架构/可靠性/安全/产品/红队/性能）× 4 轮（方案门 3 轮 + 实现后 diff 1 轮），全项目范围。

## 结论

- diff 门 6/6 通过、0 阻断；严重问题趋势 **8 → 2 → 1 → 0**。
- 已修复：路径穿越、写保护（REST+MCP 统一收紧；匿名保留 `dry_run` 体验、封顶 20 封）、批量跑批分块 + 30s deadline + 每 20 行落库、错误文案可读但不透传上游原文、导出完整性 fail-closed、默认引擎改 Gemini 兜底、RLS 脚本。
- **机器验收（checker）按决定跳过**：结论基于 6 位委员静态代码审查 + 实现者自检（未独立复核）。提交前建议按 README「提交自检」实跑一次。

## 轮次记录

| 轮次 | 硬伤数 | 主要问题 |
|---|---|---|
| round-plan-1 | 8 | 主 CTA 死链、分类默认路径必 500、路径穿越、MCP 无鉴权写库、RLS 未验证、跑批超时全丢、导出完整性 |
| round-plan-2 | 2 | UI_HANDOFF 写模式口径、缺移动端验收 |
| round-plan-3 | 1 | deadline 截断的 ran/remaining 记账口径（已按精确修法实现并通过红队穷举验证） |
| round-diff-1 | 0 | 6 维度全部通过 |

## 遗留事项（非阻断）

### 建议尽快修（改动都很小）

1. ~~`lib/llm/jev.ts:132`：`response.json()` 在错误归一化 try 之外~~ **已修（2026-09-21）**：挪进 try，200 但响应体非法 JSON → `invalid_response`（502 归一化）。
2. ~~`app/features/extraction/api/route.ts:65-69`：附件解析失败回显 `parsed.error` 原文~~ **已修（2026-09-21）**：REST 与 MCP 两侧都改为固定可读文案 + 服务端日志，不再透传解析器原文。
3. `README.md:98`「dry_run / 匿名预览不写库、重跑才有完整体」与提交自检口径（:165 匿名重跑不累积）冲突 → 改成"写模式分批续跑才累积"。**已修（2026-09-21 文档一致性清理）**
4. `README.md:80` 导出表：`submission` 导出只支持 json，表内补一句，避免评委传 md/txt 撞 400。**已修**
5. `SHARED_INTERFACES.md` mail 节缺 `POST /features/mail/api/supabase-projects/deactivate`（路由已存在，是切换项目失败后的唯一退路）。**已修**
6. `docs/PHASE2_SPEC.md:20` / `docs/MERGE_NOTES.md:46,55` 旧「服务端注入 token」措辞 → 与 SHARED_INTERFACES 统一为"仅在服务端校验口令后注入；禁止匿名可触发的自动注入转发"。**已修**
7. `lib/shared/config-store.ts` 默认值展示仍含 claude（运行时默认已是 gemini）→ 展示对齐。**已修（同时同步 PHASE2_SPEC 默认值表）**

### 已接受 / 决赛再动

- 在途块最坏时长约 80s 可超 maxDuration 60（已文档化；可收紧单调用超时彻底消除）。
- 匿名 `dry_run` 每次仍读取全部 520 封 JSON（约 0.2–1s；可优化为按 id 读取）。
- 存储层错误消息经只读接口可见（含库内结构信息、非密钥）。
- compare 接口无速率限制（匿名可触发付费调用）；SSRF 面仅 admin（决赛项）。
- 导出分母依赖 inbox 目录完整性（目录被部分拷贝且非空时会漏报完整；可加 520 下限校验）。
- `verification_results.updated_at` 刷新机制以线上控制台 DDL 为准。
- **实现与方案偏差登记**：分块粒度实际为"每波次一块 + 每 20 行落库"（原方案 `BATCH_CHUNK_SIZE=10` 未落地，性能更好）；原验证清单第 16 条按此失效。

### 需要人工操作

- **队友A**：按 `UI_HANDOFF.md` 修 7 处 `/features/verification` 404 等（演示最大风险）。
- **操作者**：Supabase 控制台执行 `scripts/phase2-rls.sql` + anon 权限探测（README「数据库初始化」）。
- **操作者**：本地如需显式 Gemini，填 `GOOGLE_GENERATIVE_AI_API_KEY`（Vercel 已配）。

## 本轮审计产出（截至记录时未提交）

- 新增 8：`UI_HANDOFF.md`、`lib/llm/errors.ts`、`lib/shared/request-errors.ts`、`lib/shared/write-policy.ts`、`lib/shared/versions.ts`、`scripts/crypto-self-test.mjs`、`scripts/check-mcp-annotations.ts`、`scripts/phase2-rls.sql`
- 修改 42（安全收紧 / 健壮性 / 文档同步），未碰任何 UI 文件。
