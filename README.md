# Shipping Doc Verifier

Averis x Monash Hackathon 2026 —— 航运单证核验。团队协作规则见 [CLAUDE.md](CLAUDE.md)，人类看的分工手册见 [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md)，模块间接口约定见 [SHARED_INTERFACES.md](SHARED_INTERFACES.md)，数据流规划见 [DATA_FLOW.md](DATA_FLOW.md)，核心决策记录见 [DECISION_LOG.md](DECISION_LOG.md)。

## 这个项目做什么

判断航运操作团队收到的邮件类型（SI请求 / BL确认 / 发票询问 / 一般询问 / 垃圾邮件），并在 BL 确认类邮件里比对 Shipping Instruction 和 Bill of Lading 草稿的字段，标出不一致的地方。详见 [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md)。

## 环境要求

- Node.js 20+（[nodejs.org](https://nodejs.org) 下载安装即可，安装时自带 npm）
- 如果要用 Docker 部署：[Docker Desktop](https://www.docker.com/products/docker-desktop/)

## 本地开发

```bash
npm install
cp .env.example .env.local   # 然后打开 .env.local 填真实的 key
npm run dev
```

打开 http://localhost:3000 。没有配置任何 LLM/Supabase key 也能跑起来看界面，但涉及真实调用的功能会报错，报错信息会说明缺了哪个环境变量。

## 导入样例数据到 Supabase（本地跑，支持增量）

数据库分三层：`raw_emails`（原始层，邮件原样）、`parsed_attachments`（文字层，附件解析出的文字 + 扁平化文本）、`verification_results`（结果层）；另有一个只读视图 `verification_overview`（结果查询用）和内部缓存 `llm_call_cache`。前两层用导入脚本填充：

```bash
npm run import:data:dry   # 先干跑一遍：只解析 data/sample、打印统计，不写库、不需要 key
npm run import:data       # 增量导入（需要 .env.local 里填了 SUPABASE_SERVICE_ROLE_KEY）
```

每行都带内容指纹（`content_hash`）：重跑时**内容没变的行直接跳过**，只有变化的才会更新，所以随便跑、不怕重复。扫描件/损坏的 PDF 会标成 `unreadable` 先搁置，以后再处理（到时候重跑脚本即可自动补上）。

## 本地评测（对照官方 ground_truth 自测）

```bash
npm run evaluate              # 全量跑 520 封：增量跳过没变的邮件，对照 ground_truth 出分数，并写入 verification_results
npm run evaluate -- --force   # 强制重算
npm run evaluate -- --limit=50  # 只跑前 50 封（调试）
npm run evaluate -- --no-write  # 只算分，不写库
```

ground_truth 仅用于自测（官方 Discord 已澄清允许），不会进最终提交文件。
当前成绩（2026-09-20）：分类 macro-F1 100%、端到端 520/520、缺陷字段 100%/100%/100%。

## REST API 与 MCP Server

查询/统计/冲突对/导出（`app/features/results/`，只读）统一从这里访问，接口格式见
[SHARED_INTERFACES.md](SHARED_INTERFACES.md)「results 模块」：

| REST（GET） | 作用 |
|---|---|
| `/features/results/api` | 按分类/状态/处理情况查结果列表（含未处理邮件），支持排序、分组、分页 |
| `/features/results/api/stats` | 总数 / 已处理 / 未处理 / 失败 / 分类分布 / 状态分布 / 差异字段频次 |
| `/features/results/api/conflicts` | 冲突文件对（SI/BL 不一致 + 需要人工确认），带两边字段值 |
| `/features/results/api/export` | Save as：`scope=results\|conflicts\|stats\|submission` × `format=json\|md\|txt` |

MCP 端点（Streamable HTTP，无状态）：

```
本地：http://localhost:3000/core/mcp-server
线上：https://hackathonaveris.vercel.app/core/mcp-server
```

共 7 个 tool：`classify_email` / `extract_document_fields` / `compare_documents` /
`list_results` / `get_stats` / `list_conflicts` / `export_results`。Claude Desktop 等
MCP client 直接把这个地址填成远程 MCP server 即可（GET/DELETE 返回 405 是正常的，
无状态模式只接受 POST）。

## Docker 部署

```bash
cp .env.example .env   # 注意这里文件名是 .env，不是 .env.local
docker compose up --build
```

打开 http://localhost:3000 。

## 生产部署（Vercel）

仓库连到 Vercel 后，push 到 `main` 会自动部署。需要在 Vercel 项目的 Environment Variables 里，把 `.env.example` 里列的变量都配置一遍（`LM_STUDIO_BASE_URL` 除外，云端用不到，见下文）。

**线上 demo 地址**：https://hackathonaveris.vercel.app （已连 GitHub `main` 分支，push 会自动重新部署。Supabase 的地址/key 已经配置好，但 LLM 的 API key 还没填，见 CLAUDE.md「项目状态」）

## 环境变量说明

见 [.env.example](.env.example)，逐条列了每个变量是干嘛的。简单说：

- Supabase 三个变量：去 [supabase.com](https://supabase.com) 建一个免费项目，在 Project Settings → API 里能找到
- 各家 LLM 的 API key：不需要全部填，缺哪个只是那个 provider 选不了，其他不受影响
- `LM_STUDIO_BASE_URL`：只有本地/Docker部署时有用，Vercel云端部署用不了本地模型（原因见 [CLAUDE.md](CLAUDE.md) "多LLM支持"一节）

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
- 查询/统计/冲突对/导出（results 模块）REST + MCP 已就绪；MCP server 已接上真正的 Streamable HTTP 握手（7 个 tool，地址见上文）
- 还没做：把"整箱流水线"（`runBatchPipeline`）包成 REST API / MCP tool（现在单封处理走三个模块各自的接口；跑批走本地 `npm run evaluate`）
- LLM key：本地缺 `ANTHROPIC_API_KEY`（抽取兜底/Claude provider 用；没配时自动降级、不影响规则路径）；Vercel 后台的 key 也还没填
