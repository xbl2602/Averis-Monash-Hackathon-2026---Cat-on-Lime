# 第二阶段功能 SPEC（2026-09-20）

本文件是第二阶段的**接口契约**：新增 3 个 feature（`config` / `mail` / `import`）。
队友A的 GUI 按这份文件对接；实现方（操作者）按这份文件交付。
所有接口统一前缀 `/features/<feature>/api`，返回 JSON；错误统一 `{ error: string }` + 合适的状态码。

## 0. 范围声明（本阶段做的 vs 不做的）

| 功能 | 本阶段（做） | 以后（预留，不在本阶段） |
|---|---|---|
| config | 配置读写接口 + 加密存储 + 掩码回显 + 测试连接 + 优先级链设置 | 多用户各自的配置 |
| mail | Gmail 连接状态/发起/断开接口、多 Supabase project 的 CRUD 与切换 | 真实 OAuth 回调、邮件收发轮询 |
| import | 单件/多选/文件夹上传接口、校验链、去重、内容识别、可复算 | 断点续传、大文件分片 |

## 1. 安全模型

> 本节的口令规则只管**本文件涉及的三个 feature**（config/mail/import）自己的接口。项目里另外还有
> `classification`/`extraction`/`comparison` 三个模块的 `POST` 端点（单文档分类/抽取/比对），
> 那三个 POST 不写库、是开放的，不需要口令——不要把下面这条规则误读成"全项目所有 POST 都要口令"，
> 具体契约见 `SHARED_INTERFACES.md`。

- 读接口：完全开放（和现有演示一致，裁判可自由查看）
- 写接口（PUT/POST/DELETE）：需要请求头 `x-admin-token: <ADMIN_TOKEN>`。
  - 服务端在 `ADMIN_TOKEN` 未配置时**拒绝所有写操作**并返回可读错误（安全默认）
  - GUI 的写操作：**推荐不做写入口**；若做，必须由操作者手动输入口令、经服务端校验后再放入 `x-admin-token`（见 SHARED_INTERFACES「写保护」）——**禁止**服务端对匿名可触发的请求自动注入 token
- 敏感字段（API key、OAuth token、Supabase service key）：
  - 存储：AES-256-GCM 加密（见第 2 节）
  - 回显：只回掩码 `sk-ant-…f3a2` 和 `has_value: true`，**永不回明文**
- 新增环境变量（写进 .env.example）：
  - `ENCRYPTION_MASTER_KEY`：32 字节 base64，缺失时敏感字段拒绝写入（读接口不受影响）
  - `ADMIN_TOKEN`：写操作口令；未配置 = 禁止写入

## 2. 加密方案（已定：AES-256-GCM）

- 文件：`lib/shared/crypto.ts`，接口：
  - `encryptSecret(plain: string): string` —— 返回 `v1.<iv_b64>.<tag_b64>.<cipher_b64>`
  - `decryptSecret(payload: string): string`
  - `maskSecret(plain: string): string` —— `sk-ant-…f3a2` 形式（前后各留 4~6 字符）
- 选择理由：对称加密（密钥要还原使用）；GCM 带认证（防篡改）；Node 原生无依赖；`v` 前缀为将来主密钥轮换留路
- 约束：密文只存数据库，明文只在服务端内存；日志/错误信息一律不得打印明文

## 3. config feature

### 3.1 数据表 `app_config`

| 列 | 类型 | 说明 |
|---|---|---|
| key | text PK | 配置项唯一名 |
| category | text | `llm` / `pipeline` / `mail` / `storage` / `general` |
| value | jsonb | 值（字符串/数字/布尔/数组） |
| is_secret | boolean | 敏感值（存的是密文，回显掩码） |
| updated_at | timestamptz | 并发冲突提示用（规范要求） |

### 3.2 配置项清单（key 名固定，GUI 按此渲染）

| key | 值示例 | 说明 |
|---|---|---|
| `llm.provider_priority` | `["rules","jev","gemini"]` | 分类/比对引擎优先级链（展示项，运行时见 DECISION_SPEC） |
| `llm.jev.confidence_threshold` | `0.85` | Jev 置信度低于此值触发人工介入 |
| `llm.default_provider` | `"gemini"` | 兜底文本模型（运行时默认同为 gemini） |
| `llm.anthropic_api_key` | 密文 | 对应 ANTHROPIC_API_KEY |
| `llm.openai_api_key` | 密文 | 对应 OPENAI_API_KEY |
| `llm.deepseek_api_key` | 密文 | 对应 DEEPSEEK_API_KEY |
| `llm.gemini_api_key` | 密文 | 对应 GOOGLE_GENERATIVE_AI_API_KEY |
| `llm.typesafe_api_key` | 密文 | 对应 TYPESAFE_API_KEY |
| `llm.lmstudio_base_url` | `"http://localhost:1234/v1"` | 明文 |
| `pipeline.concurrency` | `4` | 批量并发上限 |
| `pipeline.batch_limit` | `50` | 单次批量上限 |
| `storage.upload_max_file_mb` | `20` | 单文件大小上限 |
| `storage.upload_max_batch_mb` | `3` | 单请求合计上限（Vercel 4.5MB 限制留余量） |
| `mail.auto_sync_enabled` | `false` | 预留 |
| `mail.sync_interval_minutes` | `15` | 预留 |

配置优先级约定：**数据库有值 > 环境变量 > 代码默认值**；env 存在且从未在库里改过时，回显标记 `source: "env"`。

### 3.3 接口

```
GET  /features/config/api                       读全部配置（敏感项为掩码；?category=llm 过滤）
PUT  /features/config/api                       批量写：{ updates: [{ key, value }] }（写保护）
POST /features/config/api/test                  测试连接：{ target: "claude"|"openai"|"deepseek"|"gemini"|"typesafe"|"supabase"|"lmstudio" }
                                                → { ok: boolean, detail: string }（写保护，服务端解密后真调一次）
```

返回示例（GET）：
```json
{
  "items": [
    { "key": "llm.default_provider", "category": "llm", "value": "gemini", "is_secret": false, "source": "db", "updated_at": "..." },
    { "key": "llm.anthropic_api_key", "category": "llm", "value": "sk-ant-…f3a2", "is_secret": true, "has_value": true, "source": "env", "updated_at": null }
  ]
}
```

## 4. mail feature（占位骨架，真实连接留未来）

### 4.1 数据表

`mail_accounts`：`id`(uuid) / `provider`(`gmail`) / `email_address` / `status`(`disconnected|pending|connected|error`) /
`access_token`(密文) / `refresh_token`(密文) / `token_expires_at` / `scopes` / `last_synced_at` / `updated_at`

`supabase_projects`：`id`(uuid) / `label` / `project_url` / `anon_key`(明文，公开信息) / `service_key`(密文) /
`is_active`(bool，唯一) / `updated_at`

### 4.2 接口

```
GET  /features/mail/api/gmail                    连接状态（不回 token）
POST /features/mail/api/gmail/connect            发起连接 → { status: "not_implemented", message, redirect_uri }（写保护）
POST /features/mail/api/gmail/disconnect         断开（写保护）
GET  /features/mail/api/supabase-projects        列出项目（service_key 掩码）
POST /features/mail/api/supabase-projects        新增/更新项目（写保护）
POST /features/mail/api/supabase-projects/activate  切换启用项目（写保护）
POST /features/mail/api/supabase-projects/deactivate  停用当前启用项目，回退到环境变量配置（写保护；切换到一个配置有误的项目后的恢复通道）
```

Supabase 客户端解析优先级：`supabase_projects.is_active > 环境变量`。现有 env 方案保持可用，切换 project 后新建的请求走新项目。

### 4.3 预留的未来路径（写进接口注释）

真实接入时：Gmail OAuth（scope `gmail.readonly`）→ 回调存加密 token → 定时/手动触发 `users.messages.list` →
复用现有 classification/extraction/comparison 流水线 → 结果落 `verification_results`。

## 5. import feature

### 5.1 数据表与存储

- Supabase Storage bucket：`uploads`（private）
  - 路径：`documents/<sha256前2位>/<sha256>/<原文件名>`
- 表 `uploaded_documents`：

| 列 | 说明 |
|---|---|
| id | uuid PK |
| file_name / file_size / mime | 原文件信息 |
| storage_path | Storage 路径（原文件） |
| file_hash | sha256，唯一，去重依据 |
| parse_status | `ok` / `unreadable` / `unsupported` |
| parse_error | 读不了的原因 |
| extracted_text | 解析出的文本 |
| detected_type | `SI` / `BL` / `OTHER` / `UNKNOWN`（按内容识别，不依赖文件名） |
| review_status | `pending`（UNKNOWN 待人工归类）/ `filed` / `skipped`（重复） |
| uploaded_by | 预留（现阶段写 `"admin"`） |
| updated_at | 冲突提示用 |

### 5.2 校验链（顺序）

1. 扩展名白名单：`.txt .md .pdf .docx .xlsx`
2. 魔数校验：PDF=`%PDF`、DOCX/XLSX=ZIP 头 `PK\x03\x04`、TXT 必须无二进制控制字符
3. 大小：单文件 ≤ `storage.upload_max_file_mb`
4. 内容哈希：已存在 → `skipped`（重复），不重复解析
5. 解析文本 → 按内容识别类型（SI 特征 / BL 特征 / 其他单证特征 / 未知）
6. 落库 + 存原文件（upsert by `file_hash`）

### 5.3 接口

```
POST /features/import/api/upload     写保护
  body: { files: [{ name, mime?, data_base64 }], batch_id? }
  限制: 单请求合计 ≤ storage.upload_max_batch_mb（默认3MB），超过返回 413 + 可读提示
  返回: { batch_id, items: [{ name, status: "stored"|"duplicate"|"rejected", reason?, id?, detected_type? }] }
  ——单文件失败不影响其他文件（逐文件 try/catch）

GET  /features/import/api/documents  列表（?review_status=pending|filed|skipped&detected_type=SI|BL|OTHER|UNKNOWN&limit=&offset=）
PUT  /features/import/api/documents  人工归类：{ id, detected_type }（写保护）
```

（没有导出端点——上传文档池不接官方 submission 导出，那是 `results` 模块 `GET /features/results/api/export` 的职责，两者不要混。）

GUI 侧约定：文件夹上传用 `<input webkitdirectory>` 拿到文件列表后，**按 3MB/批**切开逐个请求；
每个批次的结果就地展示，失败的可以单独重试。

### 5.4 上传后与主流程的关系

- `detected_type=SI|BL` 的文档：进入"文档池"，后续可挂到邮件/参与比对（本阶段先入库+可查询）
- `UNKNOWN`：`review_status=pending`，GUI 提示人工归类；归类后变 `filed`
- `OTHER`：标记为"非 SI/BL 单证"，默认不参与比对

## 6. 并发与一致性

- 所有写入用 `upsert`（`app_config.key` / `uploaded_documents.file_hash` / `mail_accounts.id` / `supabase_projects.id`）
- 所有表带 `updated_at`；PUT 支持可选 `expected_updated_at`，不一致返回 `409` + 可读提示（乐观锁）
- 上传接口内并发上限 3（`mapWithConcurrencyLimit`），批量大小由客户端按批次控制
- 禁止模块级可变状态；Supabase client 按请求创建（多 project 场景尤其注意）

## 7. MCP 暴露（本阶段）

实际交付（与 SHARED_INTERFACES.md 一致，共新增 3 个，总数 11 个）：
- `sync_gmail`（占位：返回 `not_implemented` 的可读说明）
- `list_uploaded_documents`（只读）
- `classify_uploaded_document`（写库，人工归类，`readOnlyHint:false`）

说明：原计划里的 `get_config` / `update_config` 两个 tool 本期未做（配置通过 REST 接口读写，
GUI 接入用 REST 已足够；MCP 客户端如需配置能力，后续按同一 mcp/index.ts 模式补即可）。
新 tool 一律由各 feature 的 `mcp/index.ts` 定义，`app/core/mcp-server/tools.ts` 只汇总注册。

## 8. 验收清单

- [ ] `npm run typecheck` + `npm run build` 通过
- [ ] 加密单测：加解密往返、篡改密文报错、缺主密钥时写入被拒
- [ ] config：GET 掩码正确、PUT 写保护生效（无 token 401/403）、test 接口对未配置 key 返回可读错误
- [ ] import：txt/pdf/docx/xlsx 各一真实文件上传成功；坏文件/超限/重复 各自返回正确状态
- [ ] mail：未连接状态可读；connect 返回 not_implemented；切换 project 后接口使用新项目
- [ ] 现有 520 封评测回归不退化（`npm run evaluate -- --no-write`）
- [ ] 文档同步：SHARED_INTERFACES.md / README / .env.example / DATA_FLOW.md

## 9. 明确不做（防过度设计）

- 不做插件注册中心/动态加载
- 不做客户端加密（服务端必须能解密使用）
- 不做信封加密/每用户数据密钥（单租户阶段，v 前缀留了升级路）
- 不做真实 OAuth 回调（mail 占位）
- 不做上传断点续传/分片（批次机制已够用）
