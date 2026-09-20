# Shipping Doc Verifier

Averis x Monash Hackathon 2026 —— 航运单证核验。团队协作规则见 [CLAUDE.md](CLAUDE.md)，人类看的分工手册见 [TEAM_HANDBOOK.md](docs/TEAM_HANDBOOK.md)，模块间接口约定见 [SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md)，数据流规划见 [DATA_FLOW.md](docs/DATA_FLOW.md)，核心决策记录见 [DECISION_LOG.md](docs/DECISION_LOG.md)。

## 这个项目做什么

判断航运操作团队收到的邮件类型（SI请求 / BL确认 / 发票询问 / 一般询问 / 垃圾邮件），并在 BL 确认类邮件里比对 Shipping Instruction 和 Bill of Lading 草稿的字段，标出不一致的地方。详见 [OPENING_CEREMONY_NOTES.md](docs/OPENING_CEREMONY_NOTES.md)。

## 环境要求

- Node.js 22+（[nodejs.org](https://nodejs.org) 下载安装即可，安装时自带 npm；AI SDK v7 要求 Node 22 以上，Vercel/Docker 也都是 22）
- 如果要用 Docker 部署：[Docker Desktop](https://www.docker.com/products/docker-desktop/)

## 本地开发

```bash
npm install
cp .env.example .env.local   # 然后打开 .env.local 填真实的 key
npm run dev
```

开发模式（`npm run dev`）改代码即时生效。想在本地按"生产模式"跑（更接近线上行为、加载更快）：

```bash
npm run build && npm start
```

打开 http://localhost:3000 。没有配置任何 LLM/Supabase key 也能跑起来看界面，但涉及真实调用的功能会报错，报错信息会说明缺了哪个环境变量（分类/抽取/比对是"规则优先"，规则路径不依赖任何 key）。

## 导入样例数据到 Supabase（本地跑，支持增量）

数据库分三层：`raw_emails`（原始层，邮件原样）、`parsed_attachments`（文字层，附件解析出的文字 + 扁平化文本）、`verification_results`（结果层）；另有一个只读视图 `verification_overview`（结果查询用）和内部缓存 `llm_call_cache`。前两层用导入脚本填充：

```bash
npm run import:data:dry   # 先干跑一遍：只解析 data/sample、打印统计，不写库、不需要 key
npm run import:data       # 增量导入（需要 .env.local 里填了 SUPABASE_SERVICE_ROLE_KEY）
```

每行都带内容指纹（`content_hash`）：重跑时**内容没变的行直接跳过**，只有变化的才会更新，所以随便跑、不怕重复。扫描件/损坏的 PDF 会标成 `unreadable` 先搁置，以后再处理（到时候重跑脚本即可自动补上）。

## 数据库初始化（新环境 / 换 Supabase 项目必读）

现有正式项目已经建好表，**不需要重跑**；只有在换/新建 Supabase 项目时才按这里重建，并把权限核对一遍：

1. **建表**（控制台 SQL Editor 全部粘贴执行，两个脚本都可重复执行）：
   - `scripts/phase2-schema.sql`：第二阶段 4 张业务表（`app_config` / `mail_accounts` / `supabase_projects` / `uploaded_documents`）
   - `scripts/phase2-rls.sql`：给上面 4 张表启用 RLS，并给 `uploaded_documents` 建 anon select 策略
   - 主三表（`raw_emails` / `parsed_attachments` / `verification_results`）、只读视图 `verification_overview`、缓存表 `llm_call_cache` 的建表语句**不在仓库里**，需要从现有 Supabase 控制台导出后补进 `scripts/`；其中 **`verification_results` / `verification_overview` 必须保留 anon select 策略，否则 results 的 list/stats/conflicts/export 与 pipeline 的增量读取会全部失败**
2. **Storage**：Storage → 确认 bucket `uploads` 存在（private），并到 Storage → Policies 核对/记录它的访问策略（以控制台实际策略为准）。
3. **anon 只读探测**（用匿名 key 访问，验证"读全开放"没配错）：
   ```bash
   curl -s "<项目URL>/rest/v1/verification_overview?select=email_id&limit=1" \
     -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"
   ```
   期望：200 且返回一行 JSON；若 401/403 或报错，回看第 1 步的视图/RLS 策略。
4. **服务端 key**：导入/写库需要 `SUPABASE_SERVICE_ROLE_KEY`（只放服务端环境变量，绝不能加 `NEXT_PUBLIC_` 前缀）。

## 本地评测（对照官方 ground_truth 自测）

```bash
npm run evaluate              # 全量跑 520 封：增量跳过没变的邮件，对照 ground_truth 出分数，并写入 verification_results
npm run evaluate -- --force   # 强制重算
npm run evaluate -- --limit=50  # 只跑前 50 封（调试）
npm run evaluate -- --no-write  # 只算分，不写库
```

ground_truth 仅用于自测（官方 Discord 已澄清允许），不会进最终提交文件。
当前成绩（2026-09-20）：分类 macro-F1 100%、端到端 520/520、缺陷字段 100%/100%/100%。

各判断点的选项与定义、程序/模型判定标准、模型输入（扁平化）契约，统一记录在 [DECISION_SPEC.md](docs/DECISION_SPEC.md)。

## REST API 与 MCP Server

查询/统计/冲突对/导出（`app/features/results/`，只读）统一从这里访问，接口格式见
[SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md)「results 模块」：

| REST（GET） | 作用 |
|---|---|
| `/features/results/api` | 按分类/状态/处理情况查结果列表（含未处理邮件），支持排序、分组、分页 |
| `/features/results/api/stats` | 总数 / 已处理 / 未处理 / 失败 / 分类分布 / 状态分布 / 差异字段频次 |
| `/features/results/api/conflicts` | 冲突文件对（SI/BL 不一致 + 需要人工确认），带两边字段值 |
| `/features/results/api/export` | Save as：`scope=results\|conflicts\|stats\|submission` × `format=json\|md\|txt`（`scope=submission` 仅支持 json）；完整性看响应头 `X-Export-Incomplete` / `X-Export-Expected-Source`（submission 场景） |

整箱批量入口（`POST /features/pipeline/api`，会写结果表）：
不传参数 = 全量增量跑（跳过没变的），`limit` 控制单次几封，`dry_run: true` 只算不写：

```bash
# 匿名预览（不需要口令）：单次最多 20 封、不写库——适合评委/访客体验
curl -X POST http://localhost:3000/features/pipeline/api \
  -H "Content-Type: application/json" \
  -d '{"dry_run":true,"limit":50}'

# 写模式（会写库）：带服务端口令；冷缓存全量会被 30s deadline 分成多轮，重复调用自动增量续跑
curl -X POST http://localhost:3000/features/pipeline/api \
  -H "Content-Type: application/json" \
  -H "x-admin-token: <ADMIN_TOKEN>" \
  -d '{"email_ids":["email_004","email_059"],"dry_run":false}'
```

响应里的 `remaining` = 还没跑完的数量；`stopped_by_deadline=true` 表示这一轮被 30s deadline 截断，再调一次即可（写模式会跳过已经算好的）。**dry_run / 匿名预览不写库、每次只预览前 20 封；要攒齐完整体必须用写模式（带口令）分批续跑**（模型结果走 `llm_call_cache` 复用）。

单文档接口（分类/抽取/比对）GET 同一地址可以看用法，POST 示例：

```bash
curl http://localhost:3000/features/classification/api            # GET：接口用法说明
curl -X POST http://localhost:3000/features/classification/api \
  -H "Content-Type: application/json" \
  -d '{"email_id":"email_004"}'
```

格式见 [SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md)「pipeline 模块（批量入口）」。写保护规则见下文「评委体验与写保护」。

MCP 端点（Streamable HTTP，无状态）：

```
本地：http://localhost:3000/core/mcp-server
线上：https://hackathonaveris.vercel.app/core/mcp-server
```

共 11 个 tool：

| 类型 | tool |
|---|---|
| 只读（8 个） | `classify_email` / `extract_document_fields` / `compare_documents` / `list_results` / `get_stats` / `list_conflicts` / `export_results` / `list_uploaded_documents` |
| 写库（3 个，需 `x-admin-token`；`run_batch` 的 `dry_run=true` 可匿名预览） | `run_batch` / `sync_gmail` / `classify_uploaded_document` |

Claude Desktop 等 MCP client 直接把这个地址填成远程 MCP server 即可（GET/DELETE 返回 405 是正常的，
无状态模式只接受 POST）。

本地和线上是**同一份代码、同一条路径** `/core/mcp-server`，区别只在主机地址和环境变量
（本地读 `.env.local` / Docker 的 `.env`，线上读 Vercel 的 Environment Variables）。
验证握手用同一个脚本，只换地址：

```bash
# 本地（先 npm run dev / npm start，或 Docker 跑在 3000 端口）
npm run mcp:smoke

# 线上 Vercel 部署
npm run mcp:smoke -- https://hackathonaveris.vercel.app/core/mcp-server
```

脚本会依次做 initialize → notifications/initialized → tools/list → 真实调用 `get_stats`。
线上 `get_stats` 能不能出数据取决于 Vercel 的 Supabase 环境变量，握手本身不受影响。

## 评委体验与写保护（重要）

- **读接口全部开放**：结果查询/统计/冲突对/导出、MCP 的只读 tool，访客直接可看，不需要口令
- **匿名可以跑 `dry_run` 预览**：`POST /features/pipeline/api {"dry_run":true}` 和 MCP `run_batch {dry_run:true}` 不需要口令，单次自动封顶 **20 封**、不写库——适合现场体验流水线
- **写操作需要口令**：请求头 `x-admin-token: <ADMIN_TOKEN>`。`ADMIN_TOKEN` 未配置时**所有写操作一律拒绝（403）——这是安全特性，不是缺陷**；口令错误返回 401
- **写业务数据需要口令；LLM 调用结果缓存 `llm_call_cache` 会被匿名只读接口顺带写入**（缓存键包含输入指纹，无法伪造他人结果）
- 公开网页默认只做 dry_run 预览，**不做**"自动带口令写库"的入口；写模式只走 REST/MCP 手动带口令
- 用 MCP 客户端连写 tool 时，把口令配在客户端的 headers 里（各客户端写法不同，例如 `mcp-remote --header "x-admin-token: <ADMIN_TOKEN>"`，或客户端自定义 header 配置），不要把口令下发给浏览器
- `ADMIN_TOKEN` 已在 Vercel（production + preview）和本地 `.env.local` 配好；换环境部署时记得补

## 产出并自检提交文件

```bash
curl -sD headers.txt -o submission.json \
  "https://hackathonaveris.vercel.app/features/results/api/export?scope=submission&format=json"
# 检查 headers.txt：
#   X-Export-Items: 520
#   X-Export-Incomplete: false
#   X-Export-Expected-Source: sample
# 可选：用官方资料包里的评分脚本自评（路径以题目包为准）
```

- 要 520 封完整体：**带口令、非 dry_run 分批续跑**（`remaining` 递减）；**dry_run/匿名重跑不累积**（每次只预览前 20 封、不写库）
- `X-Export-Incomplete=true` 时看 `X-Export-Missing` / `X-Export-Stale` / `X-Export-Expected-Source`：缺失的、旧版本引擎的结果行需要重跑后再导出；Expected-Source 不是 `sample` 说明函数包里没读到样例清单，即使 Missing=0 也按不完整处理

## Docker 部署

```bash
cp .env.example .env   # 注意这里文件名是 .env，不是 .env.local
docker compose up --build
```

打开 http://localhost:3000 。

`.dockerignore` 会把 `node_modules` / `.next` / 真实 key（`.env*`）和官方资料包排除在构建上下文外，
真实的 key 只在运行时通过 `docker compose` 的 `env_file` 注入镜像。镜像已实际构建并启动验证过
（含 MCP 握手，见上文"验证握手"）。

## 生产部署（Vercel）

仓库连到 Vercel 后，push 到 `main` 会自动部署。需要在 Vercel 项目的 Environment Variables 里，把 `.env.example` 里列的变量都配置一遍（`LM_STUDIO_BASE_URL` 除外，云端用不到，见下文）。

**线上 demo 地址**：https://hackathonaveris.vercel.app （已连 GitHub `main` 分支，push 会自动重新部署。Supabase 读权限 + service key、Jev、Gemini 都已配好并实测可用，整箱批量也能在线上真写库；Claude/OpenAI/DeepSeek 的 key 还没填，见 CLAUDE.md「项目状态」）

## 环境变量说明

见 [.env.example](.env.example)，逐条列了每个变量是干嘛的。简单说：

- Supabase 三个变量：去 [supabase.com](https://supabase.com) 建一个免费项目，在 Project Settings → API 里能找到
- 各家 LLM 的 API key：不需要全部填，缺哪个只是那个 provider 选不了，其他不受影响；demo 的默认文本兜底是 Gemini
- `LM_STUDIO_BASE_URL`：只有本地/Docker部署时有用，Vercel云端部署用不了本地模型（原因见 [CLAUDE.md](CLAUDE.md) "多LLM支持"一节）

配置中心的「当前接线状态」（避免误解）：现在只有测试连接与配置 CRUD 会消费 `llm.*_api_key`；`provider_priority` / 阈值 / `pipeline.*` / `storage.*` 目前仍是**展示项**，改了不会立刻改变运行时行为（运行时用的是代码里的常量/环境变量）。

## 项目结构

```
/app
  /core            全局布局、导航、MCP server 汇总注册（公共区，改动前先跟队友确认）
  /features
    /classification  邮件分类模块
    /extraction      字段抽取模块
    /comparison      比对+人工确认模块
    /results         结果查询/统计/冲突对/导出（只读，REST + MCP 共用一套 logic）
    /jev-lab         Jev 结构化决策验证页
    每个模块内部分 logic/（业务逻辑）api/（HTTP接口）mcp/（MCP tool定义）ui/（网页组件）
/lib
  /shared          跨模块共享的类型定义和工具函数
  /llm             多LLM统一调用层
/data/sample       官方提供的样例邮件数据（参赛者安全版，不含答案）
/scripts           本地工具脚本（导入样例数据到 Supabase 等，不参与线上运行）
```

完整的架构规范和约束见 [CLAUDE.md](CLAUDE.md)。

## 当前状态

- 引擎完成：规则优先 + Jev 判断 + LLM 兜底；全量评测 **520/520 端到端一致、缺陷字段 0 漏报 0 误报**（见上文"本地评测"）
- 数据层就绪：`raw_emails` / `parsed_attachments` / `verification_results` 三张表 + 只读视图 `verification_overview` + 内部缓存表 `llm_call_cache`，导入脚本支持增量（见上文）
- 查询/统计/冲突对/导出（results 模块）REST + MCP 已就绪；MCP server 已接上真正的 Streamable HTTP 握手（共 11 个 tool，地址见上文）
- 整箱批量入口已就绪：`POST /features/pipeline/api` + MCP `run_batch`（增量跳过没变的、单封失败不拖垮整批、失败也留痕；`dry_run` 可只算不写）
- 部署验证：MCP 握手 + 全部 tool、结果查询/导出、提取（TXT/PDF/XLSX/DOCX）、Jev/Gemini 分类、整箱批量，已在本地 `next start`、Docker 镜像和线上 Vercel 上实测通过
- 已修的两个服务端 bug：① extraction 的 REST/MCP 之前把 PDF 按 UTF-8 直接读（现在统一走格式解析）；② Next 打包器会丢 `pdf.worker.mjs` 导致服务端 PDF 解析失败（已把 `pdf-parse`/`pdfjs-dist` 声明为 `serverExternalPackages`）
- LLM key：本地缺 `ANTHROPIC_API_KEY` 等云端 LLM key（没配时自动降级、不影响规则路径）；Vercel 上 Supabase service key、Jev（`TYPESAFE_API_KEY`）和 Gemini 已配好并实测可用（含 `run_batch` 真写库），Claude/OpenAI/DeepSeek 还没填（选这几个 provider 会返回可读的缺 key 错误）
- 第二阶段（功能已合并，详见 [PHASE2_SPEC.md](docs/PHASE2_SPEC.md)）：**config 配置中心**（GUI 可调、敏感值 AES-256-GCM 加密、读开放/写口令保护）、**mail 占位接口**（Gmail 连接状态 + 多 Supabase 项目切换与停用恢复）、**import 文档上传**（单件/多选/文件夹、校验链、内容哈希去重、按内容识别 SI/BL、原文件存 Storage）。新增 4 张业务表与 `uploads` bucket（RLS 脚本见 `scripts/phase2-rls.sql`；线上实际策略以控制台为准，核对/探测方法见上文「数据库初始化」）。
  - **线上写入已配置**（2026-09-20）：`ENCRYPTION_MASTER_KEY` / `ADMIN_TOKEN` 已加进 Vercel（production + preview），线上实测：无口令写入 401、带口令可写、敏感值加密存储；本地 `.env.local` 有同样的值。如需在其他环境部署，记得补这两个变量（见 `.env.example`）
  - GUI（配置页/上传页）由队友A负责接入，接口契约见 [SHARED_INTERFACES.md](docs/SHARED_INTERFACES.md) 的 config / mail / import 章节
