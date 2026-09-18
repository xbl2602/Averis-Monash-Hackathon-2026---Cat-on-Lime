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
    每个模块内部分 logic/（业务逻辑）api/（HTTP接口）mcp/（MCP tool定义）ui/（网页组件）
/lib
  /shared          跨模块共享的类型定义和工具函数
  /llm             多LLM统一调用层
/data/sample       官方提供的样例邮件数据（参赛者安全版，不含答案）
```

完整的架构规范和约束见 [CLAUDE.md](CLAUDE.md)。

## 当前状态

核心骨架已经搭好（三个模块的 Web UI / REST API / MCP tool定义都能跑通，但业务逻辑还是占位实现，永远返回固定的假数据）。三人认领模块后，把各自 `logic/` 文件夹里的占位函数换成真实逻辑即可，其他层（api/mcp/ui）大概率不用大改。
