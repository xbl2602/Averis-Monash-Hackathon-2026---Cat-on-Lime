# TODO（待办清单）

> 来源：2026-09-21 的一次"题目要求 × 竞品调研 × 现码核对"审计（只读核对，未改代码）。
> 用法：拿一项做一项；**做完把 `[ ]` 改成 `[x]`、在下面加一行"证据:"，不要只改状态**。
> 优先级：P0 = 影响"能不能交/能不能跑"；P1 = 明显加分项；P2 = 有余力再做。
> 每个任务都自带"证据（现状）"与"验收标准"，新接手的 AI 不需要再通读全仓就能开工。

---

## P0 — 先解决"能不能跑/能不能交"

### [x] P0-1 把核心三表 DDL 补进仓库（否则换环境跑不起来）
- **做了什么**：新增 `scripts/core-schema.sql`——用 Supabase `list_tables` 内省正式项目（`rapuvaalzlrsjodjwqtw`）导出的真实结构（不是从代码猜的），含 `raw_emails` / `parsed_attachments` / `verification_results` / `llm_call_cache` 四张表的完整 DDL（列/默认值/check 约束/外键/comment）+ 视图 `verification_overview`（`security_invoker=true`）+ 三张业务表的 anon select 策略（`llm_call_cache` 故意不给 anon 策略，只走 service role，和线上 `pg_policies` 查询结果一致）。全部 `create table if not exists` / `create or replace view`，幂等。
- **同步更新**：README「数据库初始化」一节改成先跑 `core-schema.sql` 再跑 `phase2-schema.sql` + `phase2-rls.sql`。
- **验收待做**：还没在一个全新 Supabase 项目上实跑验证过（本地开发用的是现有正式项目，没有"全新项目"可测）；以后真要换/新建 Supabase 项目时留意是否需要微调。
- **注意**：DDL 里不含任何答案/ground_truth 内容。

### [x] P0-2 README 的 ground_truth 口径改准
- **做了什么**：README 那句话改成"ground_truth 仅用于本地自测：官方已明确确认题目包（含 `ground_truth.json`）允许参赛者使用，唯一约束是它只用于自测、绝不进最终提交文件（口径见 `AGENTS.md`/`CLAUDE.md`「评审沉淀」⑤）"——去掉了容易引起歧义的"Discord 已澄清"表述，改成直接指向仓库里已经写明的权威口径来源。

---

## P1 — 明显加分（对齐竞品头部做法）

### [x] P1-1 人工复核闭环——后端（REST+MCP）已做完，GUI 留给队友A
- **做了什么**：没有做"最小版"，而是按 `docs/REVIEW_SPEC.md` 把四个模块（classification/extraction/comparison/pipeline）的 REST（`api/review/{route,history,undo,bulk}`）+ MCP（4 tool × 4 模块 = 16 个）都接完了，共用层在 `lib/shared/review/`（`store`/`actions`/`normalize`/`merge`/`rerun`/`http`/`mcp`/`types`，8 个文件）；`scripts/review-schema.sql` 两张表已建并应用到正式 Supabase 项目；results 导出已接 `applyOverridesToSubmission`（`X-Review-Pending`/`X-Review-Deferred` 响应头）。**没做 GUI**（按要求）。
- **三处偏差**（详细原因见 `docs/REVIEW_SPEC.md` 第15节 / `DECISION_LOG.md` 决策31）：① 没建 httpOnly cookie 会话——GUI 不做，REST/MCP 沿用现有 `x-admin-token` 口径，等做 GUI 时再补；② classification 复核队列目前只覆盖"全模型失败降级"，不覆盖"Jev 置信度<0.85 但没失败"（这个信号目前没持久化进 `verification_results`，需要单独一次 schema 改动，需要操作者确认，未包含在这轮）；③ MCP 没做独立 bulk tool（批量只走 REST，符合 REVIEW_SPEC §8 原定范围，不算真偏差）。
- **实测中发现并修了一个真 bug**：`listOverrides` 原来用 PostgREST 的 `.in()` 传几百个 email_id 会被判 400（URL 太长）；改成按 `target_kind` 整表取回再在内存过滤，问题消失。
- **验收**：本地 `next dev` 对 comparison 模块实测 confirm/correct/undo/bulk（含失败隔离）/ 乐观锁 409 / 一致性校验 400 / 导出叠加头随动作变化，全部通过；测试数据已清空不留库里；`npm run typecheck`、`npm run build`、`npm run test:mcp-annotations`（白名单已更新）均通过。
- **注意**：没有任何地方读取/引用 `ground_truth`。

### [x] P1-2 AI 失败改为"自动重试一次"，而不是只给一键重试
- **做了什么**：`lib/llm/index.ts` 的 `callLLM` 现在对超时/限流/上游5xx/网络错误（`isRetryableUpstreamError`）在同一 provider 内自动重试一次（等 2 秒）；401/403/400/422 这类重试也没用的错误不重试、直接失败。这层重试只发生在单个 provider 内部，**不影响、不替代**现有的 `lib/shared/llm-chain.ts` 跨 provider 降级链——同一次分类/抽取/比对里，会先在当前 provider 内重试一次，仍失败才轮到降级链换下一个 provider，最后才是 `degraded` 兜底。`callJev` 保持不重试（失败直接转上层降级路径，行为不变）。
- **同步文档**：`docs/DECISION_SPEC.md` §1.5、`lib/llm/errors.ts`、`lib/llm/jev.ts` 里"不重试"的旧说法已更新；`DECISION_LOG.md` 新增决策30记录这次改动。
- **验收**：`npm run typecheck` 通过；重试只在 console.warn 留痕，不改变对外错误契约（仍是 LLMConfigError / UpstreamServiceError 两种）。

### [ ] P1-3 写一份风险文档（扰动结果 + 已知弱点 + 反文件依赖加固）
- **现状/证据**：扰动测试已做：`scripts/perturb-generate.mjs` / `perturb-run.ts` / `perturb-score.ts`，最近一次结果在 `private/perturb-runs/2026-09-20T13-59-45-official/summary.md`（总体 accuracy 1.000、缺陷 F1 0.986、端到端 287/294=0.976、review recall 0.911）。**但风险文档不存在**（`private/` 目前只有竞品调研两个文件）。
- **做法**：在 `private/`（不提交、不公开）写 `risk-notes.md`：① 扰动各组结论与**已知弱点**（pt7/pt13 的 field F1=0.600，需写明原因与影响面）；② 附件类型识别对文件名的依赖程度与已加的"看内容"兜底（`lib/shared/document-identify.ts`）；③ 无 OCR 的策略与影响（扫描件→`unreadable`，见 `docs/FINALS_ROADMAP.md:44,80`）；④ "520 封满分 ≠ 未见数据"的局限声明。
- **验收**：文档能回答"换一批没见过的邮件，最可能在哪几类出错、怎么发现"。

### [x] P1-4 重量/数量容差：已实现（审计时看漏，非新做）
- **证据**：`docs/DECISION_LOG.md` 决策28 + `app/features/results/logic/numeric-query.ts`——conflicts 查询已支持 `numeric_mode=exact|fuzzy`、`tolerance`、`value_field`/`value` 按值搜索，用户可选精确/模糊；默认容差重量 `max(0.5kg, 0.1%)`、箱数 0。REST + MCP 同参，conflicts 导出同样支持。
- **口径**：这个容差**只用于冲突查询/筛选**，不进 `scope=submission` 的最终判定——官方生成器差异量级大，提交路径加容差会漏检，故提交判定保持精确比较（`comparison/logic/index.ts` 不变）。这条本来就是决策28的既定口径，不是新决定。
- **结论**：这项 TODO 是 2026-09-21 审计时的疏漏（漏看了决策28和已有代码），实际不需要再做。

### [ ] P1-5 多 LLM 云端验收（DeepSeek 待下次部署后重测，Claude/OpenAI 仍缺 key）
- **现状/证据（2026-09-21 复核）**：`DEEPSEEK_API_KEY` 已经填进 Vercel（`filter_project_envs` 确认变量存在），但填入时间（`updatedAt=1789952512687`）晚于当时线上最新一次部署（`d071ae9`，`created=1789914468786`）——Vercel 的环境变量改动只在下一次部署后才对已运行的函数生效。实测 `POST https://hackathonaveris.vercel.app/features/classification/api {"provider":"deepseek"}` 目前仍返回"缺少环境变量"，符合这个解释（不是没填，是没重新部署）。
- **做法**：本轮改动 push 后会自动触发新部署，到时候重新跑一次上面这条 curl 验证 DeepSeek 转正；`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` 仍需团队自己申请后填入 Vercel。
- **验收**：新部署后 DeepSeek 分类请求返回正常结果（不再报缺 key）；Claude/OpenAI 补齐前如实在 README 标注"未配置"。

---

## P2 — 有余力再做

### [ ] P2-1 封版指纹（"交的卷子和考的一致"）
- **现状/证据**：只有 `logic_version` / `input_hash` 落库（`lib/shared/versions.ts`、`lib/shared/verification-store.ts`），没有"判卷用到的源文件清单 + 指纹 + 一键校验"脚本。
- **做法**：新增脚本，对判卷/提交链路上的源码与脚本算哈希清单落盘，附一个 `verify` 命令比对。**清单文件不要包含答案内容**。
- **验收**：`verify` 在不改动代码时全绿，改一行则报出是哪一份文件变了。

### [ ] P2-2 "不做 OCR"的策略写进对外的 README/提交材料
- **现状/证据**：策略已写在内部 `docs/FINALS_ROADMAP.md:44,80`（扫描件/无文字层 → `NEEDS_REVIEW`），但 README 与提交材料没写，容易被误认为"漏做"。
- **做法**：在 README 的"能力边界"处补 2-3 句：为什么不做 OCR、遇到扫描件怎么处理、这对准确率轴的影响。

### [ ] P2-3 分类"需人工看"用到界面上（前端，队友A）
- **现状/证据**：后端已返回 `needs_review`，竞品调研第 7 节点名"算了不展示"是暗坑（`private/competitor-research-plain.md` 第 132、155 行）。
- **做法**：结果列表/详情把 `needs_review` 与 `review_reason` 显式展示并可筛选。

### [ ] P2-4 修导航里指向不存在页面的链接（前端，队友A）
- **现状/证据**：竞品调研与 `docs/UI_GUIDE.md` 都提到有一个导航链接指向尚不存在的页面（`/features/verification`，`docs/HISTORY.md:407` 记录过 404）。`app/features/verification/ui` 文件存在，需要确认路由与导航是否对上。
- **验收**：导航里每个链接点开都是 200。

### [ ] P2-5 加最小 lint + CI
- **现状/证据**：有 `npm run typecheck`（`package.json:13`，`tsconfig.json` strict），但**无 ESLint、无 `.github/workflows`**，验证靠手跑脚本。
- **做法**：加 ESLint（Next 官方配置）+ 一个 CI 跑 `typecheck`（+ 可选的 `test:mcp-annotations`、`test:crypto`）。不要引入重型框架。

### [x] P2-6 同步文档里已知的 6 处不一致
- **做了什么**：`docs/PHASE2_SPEC.md` 删掉不存在的 `documents/export` 端点、`test` 接口目标清单补 `lmstudio`、`§4.2` 补 `supabase-projects/deactivate`、import 列表端点补 `detected_type` 查询参数、`§1` 加了一句澄清"口令规则只管 config/mail/import 自己的接口，不是全项目所有 POST"。`docs/SHARED_INTERFACES.md` 补了 classification/extraction/comparison 三个 REST 端点的表格和对应的 3 个 MCP tool 名。`docs/UI_GUIDE.md` 第6节清空重复内容，改成指回这两份文件。

### [x] 验证：评委安装部署便利性 + 新增 sandbox 模块（评委自带测试集，单条版）
- **做了什么**：① 实测（不是看文档猜）本地零配置 `npm run dev` 和 Docker `docker compose up --build` 两条路径，确认首页/Full pipeline 预览页/`dry_run` 批量预览在完全没有 Supabase/LLM key 的情况下也能正常工作（规则引擎优先 + 样例数据读本地文件，不依赖数据库）；README 新增"评委/新人 30 秒看到它跑起来"一节把这条路径讲清楚，并说明 Supabase 的 anon key 本身不敏感、可以直接问操作者要现成的，不需要评委自己注册账号。② 发现一个真实架构缺口：分类/抽取的单文档接口只能对着仓库自带样例数据用，评委带自己的新邮件/SI/BL 文件没法测——新增 `app/features/sandbox/`（`POST /features/sandbox/api` + MCP `run_adhoc_test`）补上，不写库、不需要配置 Supabase，复用生产同一套抽取/比对引擎。顺带把 `import` 模块的文件校验逻辑抽出成 `lib/shared/file-validate.ts` 供两边共用。
- **决策记录**：`DECISION_LOG.md` 决策32。
- **验收**：用真实样例文件（已知有差异的 email_004 SI/BL）当"评委自己的文档"喂给 sandbox 接口，结果和正式流水线完全一致；错误路径（坏扩展名/坏base64/超限/缺文件）都返回可读错误。`npm run typecheck`、`npm run build`、`npm run test:mcp-annotations` 均通过。
- **还没做**：批量测试集版本（一次上传一整批邮件+附件跑整箱）——操作者明确说"两个都要，先做单条"，批量版视时间决定；sandbox 的 GUI 页面（`docs/UI_GUIDE.md` §2.8 已写好交接说明，归队友A）。

---

## 已完成（不要重复做）

- [x] 官方判卷并留档：`private/eval-runs/20260920-1757/official-score.json`（final 1.0；分类 1.0、缺陷 F1 1.0、端到端 46/46、reliability 20/20；`score_cli.py` 交叉同分）
- [x] AI 失败退回规则（`lib/shared/llm-chain.ts` + `rules.ts` best-effort）
- [x] 附件按内容识别兜底（`lib/shared/document-identify.ts`）
- [x] 提交前格式/覆盖检查（`app/features/results/logic/export/index.ts:108,155-158`）
- [x] 文字比对分级（canonical → exact → 中间地带才 Jev）
- [x] 字段级出处落库（`label-parser.ts:88-115` + `scripts/phase3-evidence-migration.sql`）
- [x] 扰动测试 harness 与最近一次成绩
- [x] MCP 注解 fail-closed + 自检脚本（`scripts/check-mcp-annotations.ts`）
- [x] 三种部署文件齐备（`Dockerfile` / `docker-compose.yml` / `next.config.mjs` standalone）
- [x] 已把 `docs/REVIEW_SPEC.md` 登记进 `docs/README.md`
- [x] 导出新增 `format=csv`（响应 2026-09-21 workshop 业务方明确要的"SI/BL值+为什么mismatch"表格，见 `docs/HISTORY.md` Workshop 2、`docs/DECISION_LOG.md` 决策33）。`scope=conflicts` 是一行一个待改字段的 amendment list；`submission` 仍只认 json。README/UI_GUIDE 已同步
- [x] 开发者模式后端（数据库清空/恢复，仅内部/评委验证用，见 `docs/DECISION_LOG.md` 决策34）：`app/features/devmode/` 三个端点（状态查询/清空/恢复），双门槛（口令+确认短语逐字匹配），刻意不注册 MCP tool。**GUI 还没做**——`docs/UI_GUIDE.md` §2.9 写了硬性要求（持续可见警示条、打字确认而非一键弹窗），交给队友A，优先级低于人工复核 GUI
