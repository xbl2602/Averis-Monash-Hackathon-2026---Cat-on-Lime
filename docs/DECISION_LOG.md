# 决策记录

> 记录项目过程中做过的核心决策：定了什么、为什么这么定、有没有别的选项被放弃。
> 跟 [CLAUDE.md](../CLAUDE.md) / [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md) 的区别：那两份文件是"现在生效的规则"，
> 这份文件是"这些规则是怎么来的、当时权衡了什么"——规则改了可以回来查历史，吵起来也有据可查。
> 更新：2026-09-18

---

## 1. 项目背景

Averis x Monash Hackathon 2026，3人团队，全员无编程背景，各自用 AI 编程工具（Claude Code）并行开发。
完整背景见 [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md) 第0-2节。

---

## 2. 决策记录（按时间线）

### 决策 1：团队规模是 3 人，不是 4 人

- **背景**：最初按"我和朋友3"理解成"我+3个朋友=4人"，写进了初版文档。
- **纠正**：操作者明确说"我们是只有一共3个人"，全文档批量改正（`4人`→`3人`等）。
- **影响**：协作模型、分工示例都按3人设计，不是4人。

### 决策 2：协作模型 = 3人各自开独立 AI session 并行开发，靠 Git 整合

- **背景**：全员无编程/比赛经验，需要决定"谁来操作AI编程工具"。
- **选项**：单人主导 vs 3人各自并行开发。
- **结论**：选了后者（3人各自并行）——优点是效率高、每人都能全程参与；
  代价是"3个AI session同时改代码"天然容易冲突，需要额外的架构+流程设计来兜底
  （见决策3、决策4）。

### 决策 3：架构原则定为"一切皆插件"——轻量文件夹隔离，不做真正的插件运行时

- **背景**：3人并行开发容易互相冲突，且决赛要求"在初赛基础上加功能，不能推倒重做"。
- **原则**：核心（core）只放最少公共骨架，其余功能各自一个自包含文件夹。
- **明确排除的选项**：真正的运行时动态加载/卸载插件系统（插件注册中心、动态import、
  生命周期管理）——评估后认为这是不必要的额外复杂度，4天零经验场景做不完也没必要。
- **后续修正**（用户提出的架构评审）：文件夹应该**按功能命名，不按人名命名**
  （比如 `classification/` 而不是 `feature-a/`），负责人另开一张表映射，
  这样重新分工不用改文件夹名字。

### 决策 4：Git 工作流 = GitHub Flow + 每日轮值集成员 + 新手用 GitHub Desktop

- **背景**：调研发现"AI编程工具不会自动处理多人并行改同批文件的冲突"，
  且团队没人用过 Git。
- **结论**：短分支（`姓名/任务简述`）+ 小步提交 + PR合并 + 每日轮流一人当"集成员"；
  工具上用 GitHub Desktop 图形界面操作分支/提交/推送/合并，Claude Code 只负责写代码和解释冲突，
  不托管无监督的破坏性 git 操作。
- **配套安全规则**：写进 CLAUDE.md——禁止在没有明确确认的情况下运行
  `git reset --hard` / `git clean -f` / 强制推送等破坏性命令（现实中出现过AI因为用户一句
  模糊的"清理一下"就跑出破坏性命令、清空未提交代码的真实案例）。

### 决策 5：技术栈锁定为 Next.js + Supabase + Vercel（不是"默认建议"，是确认过的决定）

- **背景**：团队零经验，需要"AI生成代码出错率最低、运维成本最低"的组合。
- **结论**：Next.js（App Router）+ Tailwind + Supabase + Vercel部署，调研认为这是当前
  AI编程工具生态里"低幻觉率"标准搭配。操作者后来明确二次确认"这点确认了"，从"默认建议"
  升级为"已确认，不因题目变化而重新考虑"。

### 决策 6：题目为航运单证核验（2026-09-18 开幕式官方公布）

- **背景**：赛前只能靠"主办方 Averis 是航运单证外包公司"这条线索推测方向。
- **公布内容**：判断邮件类型（SI/BL确认/发票询问/一般/垃圾邮件），对 BL确认类邮件
  比对 Shipping Instruction 与 Bill of Lading 草稿的7个字段，标出不一致处，拿不准时
  提示人工介入。完整细节见 [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md)。
- **验证**：赛前"企业后台/供应链场景"的推测被证实是对的。

### 决策 7：功能模块划分为 `classification` / `extraction` / `comparison` 三个插件

- **背景**：官方题目本身就是"分类→抽取→比对"三步流水线，天然对应3人3块。
- **结论**：按这三步拆 `/app/features/` 下的三个文件夹，写进 CLAUDE.md，
  负责人待3人内部认领（当前仍是占位，未认领）。

### 决策 8：产品形态必须同时支持 Web UI + REST API + MCP Server（初赛截止前，不留到决赛）

- **背景**：操作者明确要求"不能只是一个网页表单"，三种接口都要能被外部访问/测试。
- **关键实现原则**：三层共享同一套 `logic/` 业务逻辑，不重复实现三遍
  （`logic/api/mcp/ui` 分层，见 CLAUDE.md）。
- **技术选型**：MCP 用 HTTP/SSE（streamable HTTP）而不是 stdio，因为要和 Web/API
  一起部署在 Vercel 上对外提供服务，stdio 只能本地进程调用。

### 决策 9：部署方式必须同时支持本地 / 云端(Vercel) / Docker 三种

- **背景**：操作者要求"易于安装和部署"，不能只能在 Vercel 上跑。
- **结论**：同一份代码三种启动方式，靠"所有密钥走环境变量 + 不用 Vercel 专属功能"
  做到不用为每种部署方式改代码。Vercel 仍是初赛/决赛对外展示用的正式demo地址，
  本地/Docker 是"任何人不依赖 Vercel 账号也能自己跑起来"的能力。

### 决策 10：多 LLM 支持——Claude / ChatGPT / DeepSeek / Gemini / 本地 LM Studio 初赛都要跑通

- **背景**：操作者要求系统支持多个LLM，包括本地LLM。
- **关键技术判断**：不为每个LLM单独写调用代码，靠 Vercel AI SDK 的统一 provider
  接口 + DeepSeek/LM Studio 复用 OpenAI 兼容协议（换 baseURL 即可），把工作量压到
  主要是配置而不是重新实现。
- **验收标准放宽**：Claude 必须稳定（demo兜底），其余4个只要求"能选、能切换、
  基本跑通一次调用"，不要求都调优。

### 决策 11：本地 LLM 的适用范围限定——只在本地/Docker部署时生效，Vercel云端demo用不了

- **背景**：操作者发现"部署到Vercel、又要用本地LLM"逻辑上有矛盾点，提出疑问。
- **结论**：这是网络可达性的硬限制，不是设计选择——Vercel无GPU、无法访问操作者
  自己电脑的 `localhost`。本地LLM能力保留在代码里（本地/Docker模式下真实可用），
  Vercel公开demo默认用云端provider，UI上需要优雅隐藏/提示而不是报错崩溃。
- **未来路线图（不在初赛做）**：如果以后想让公开demo也用开源模型，需要另外接一台
  GPU云主机（RunPod/Together.ai等）跑推理服务，这是独立的新基础设施，
  记入决赛/未来规划slide即可。

### 决策 12：代码质量红线——禁止 God 文件、单一职责、基本错误处理，不可妥协

- **背景**：操作者要求系统"不只是能跑，可维护性/健壮性/可扩展性是核心目标"。
- **结论**：明确这跟"业务功能不要预先设计"不矛盾——业务逻辑可以简单，但代码结构
  （文件拆分、函数职责、错误处理）必须干净。单文件超过约300行是该考虑拆分的信号。

### 决策 13：调试规范——禁止打补丁式debug，必须找根因

- **背景**：操作者担心AI遇到报错会用"吞掉异常/绕过症状/硬编码掩盖问题"这类补丁手法。
- **结论**：明确列出"什么算打补丁"（吞异常、针对性if绕过、无脑重试、写死值掩盖问题）
  和"遇到bug该怎么做"（找根因→修根源→用大白话解释→实在定位不到就如实说明），
  写进 CLAUDE.md 强制执行。

### 决策 14：发现官方资料包中混入组织者专用答案文件，仓库当时为 Public——已提醒，操作者决定暂不处理

- **发现**：官方通过QR码发给参赛者的资料包里，`sdoc-hackathon-docker/` 这个子文件夹
  实际是标注"ORGANIZERS"（仅供主办方）的私有分发包，内含 `ground_truth.json`
  （520条真实评分答案），且已经被 commit 并推送到当时是 Public 的 GitHub 仓库。
- **核实**：打开确认了内容确实是逐邮件不同的真实标注（不是格式模板），
  跟参赛者应得的 `sample_submission.json`（全部占位值）明显不同。
- **建议但未执行的动作**：仓库改Private、告知主办方、清理git历史（涉及force push，
  按 CLAUDE.md 的破坏性操作规则未经确认不会执行）。
- **操作者的回应**：认为这是官方通过同一QR码发给"全部参赛者"的内容，"官方给了肯定有理由"，
  选择不处理，继续原定任务。
- **记录这条的原因**：这是一个操作者知情后主动做出的决定，不是被忽略或遗漏——
  写代码时不会读取/参考 `ground_truth.json` 的内容，但仓库本身的处置是操作者的选择，
  这里如实记录当时的判断依据，供以后需要时回溯。
- **后续更新（见决策21）**：官方后来在 Discord 官方公告里澄清，这份文件是特意给
  参赛者用来自我评估用的，README 写"ORGANIZERS"只是没更新的旧说法——之前"完全不用"
  的判断已经不成立，改成了"能用于自测，不能用于直接拼答案"，具体见决策21。

### 决策 15：官方真实数据格式比开幕式听写稿更精确，已改用官方原始 schema

- **背景**：开幕式转录里 Sergio 口头提到的字段名（如"weight"）是转录整理出来的近似说法。
- **发现**：官方资料包（安全的参赛者版 `sdoc-hackathon-bundle`）里的 `README.md` +
  `sample_submission.json` 给出了精确的字段名和枚举值：字段是 `gross_weight_kg`
  不是简单的"weight"，分类枚举是 `BL_COMPARISON`/`SI_REQUEST`/`INVOICE_QUERY`/
  `GENERAL`/`SPAM`，比对状态是 `OK`/`MISMATCH`/`NEEDS_REVIEW`。
- **结论**：`lib/shared/types.ts` 和 `SHARED_INTERFACES.md` 按这份更精确的官方schema编写，
  这是"最终提交给评分系统"要严格匹配的格式，不能按听写稿的近似说法随意命名字段。

### 决策 16：核心框架骨架搭建完成，验证方式 = 实际跑通而非只有文件

- **范围**：Next.js项目初始化、三个feature模块的 `logic/api/mcp/ui` 四层骨架、
  `lib/llm` 多LLM适配层、`lib/shared` 类型与数据读取工具、Dockerfile/README/.env.example、
  MCP汇总注册端点（协议握手部分留TODO，未假装做完）。
- **验证方式**：`npm run build` 编译通过；实际启动服务对三个模块的API逐一发真实请求
  验证返回正确（分类返回占位值、抽取返回占位值、比对用故意不同的假数据验证能正确
  检测出差异）；MCP占位端点确认能列出已注册的3个tool。Docker构建因为这台机器
  Docker Desktop未启动，没有做到实际验证，只做到了写好Dockerfile。
- **明确排除的范围**：三个模块的真实业务逻辑（占位实现，标了TODO给负责人）、
  MCP协议真实握手（只做到"能列出tool"）——这些是"地基"之上的真功能，不属于本次搭建范围。

### 决策 17：Supabase / Vercel 真实项目本来就已存在，接上并关闭了挡住评委的 SSO 保护

- **背景**：操作者问"怎么没看到supabase和vercel注册"，一查发现两个云账号下其实早就有同名
  `hackathon-demo` 项目（应该是团队之前建好但没人跟AI提过），不需要重新注册。
- **做了什么**：把 Supabase 真实的项目地址和公开 key 取出来写进本地 `.env.local`
  （不进git，只影响自己电脑本地开发）；检查发现 Vercel 项目默认开着"SSO Protection"，
  会导致外人（包括评委）打开线上demo网址时被拦在登录页——操作者明确授权后关闭了这个开关。
- **验证**：关闭后重新查询项目设置，确认 `ssoProtection.enabled` 已经是 `false`。
- **仍未解决**：这个 Vercel 项目还没连上 GitHub 仓库——查了部署记录，从建项目到现在只有
  一条部署，且不带任何 git commit 信息，说明现在 `git push` 不会自动更新线上demo。
  Vercel 没有对应的API能完成"连接已有项目到Git仓库"这一步（这类授权类操作只能在网页后台
  手动点），需要团队有人手动去 Vercel 后台 Settings → Git 里连一下。

### 决策 18：发现操作者实际连的是另一个新项目 `hackathonaveris`，确认它为正式demo项目

- **背景**：操作者按决策17的步骤去连Git，回来说"已经搞定"，但查证发现决策17里那个
  `hackathon-demo` 项目依然没有任何新部署——操作者实际操作的是账号下**另一个项目**
  `hackathonaveris`（此前没人提过，应该是操作者这次顺手新建的）。
- **核实**：查询 `hackathonaveris` 的部署记录，确认它的最新部署带着正确的 git commit 信息
  （commit信息对得上我们刚push的那条），证明它确实已经跟 `xbl2602/Hackathon` 仓库的
  `main` 分支连好，push 会自动触发部署；SSO保护也是默认关闭状态。
- **决定**：账号下同时存在 `hackathon-demo`（旧的，没连Git，停用）和 `hackathonaveris`
  （正确连好的）两个项目容易让人混淆——问过操作者后，确认以 `hackathonaveris` 为准，
  之后 CLAUDE.md / README.md 里的demo地址、环境变量说明都改成指向这一个。
- **补做的事**：`hackathonaveris` 项目面板里虽然有 `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` 这两个环境变量的"位置"，但值是空的——因为这两个是
  公开、非密钥性质的值（Supabase 的 anon key 本来就设计成可以暴露在浏览器端），
  直接把已经取到的真实值填了进去，并触发了一次新部署让它生效。
  `SUPABASE_SERVICE_ROLE_KEY` 和各家 LLM 的 API key 是真正的私密key，没有去申请/查看，
  留空，需要团队自己去后台填。

### 决策 19：新增"高并发与数据同步/冲突处理"硬性要求，并审计了现有代码架构

- **背景**：操作者明确要求代码架构要考虑高并发和多方同时操作时的数据同步/冲突问题，
  要求先更新规范文档，再检查现有代码是否符合，不符合就改。
- **审计结论**：审查了当时所有已存在的代码（`lib/shared/*`、`lib/llm/index.ts`、
  三个 feature 模块的 `logic/api/mcp`、`app/core/mcp-server/*`）——目前没有发现
  违反并发安全的代码，因为项目还在"地基"阶段，没有模块级可变状态，也还没有
  批量处理逻辑或 Supabase 真实写库代码，所以现状不存在"并发下会出错"的具体代码，
  自然也就没有能改的bug。
- **做了什么**：把要求写成 CLAUDE.md 新增的一节「高并发与数据同步/冲突处理」，覆盖
  5类硬性规则：禁止模块级可变状态、批量处理要用"有上限的并发"而不是全排队或全并行、
  单条失败不能拖垮整批、写Supabase要用 `upsert`（以 `email_id` 等做唯一约束）不要
  "先查再insert"、人工可编辑的表要留 `updated_at` 字段方便以后做基本冲突提示、
  API/MCP路由必须保持无状态。同时新建了 `lib/shared/concurrency.ts`，导出
  `mapWithConcurrencyLimit` 工具函数（控制批量处理时的并发上限+隔离单条失败），
  这是纯粹的基础设施代码，不是业务逻辑，跟"不要为假设性需求预先设计接口"的原则
  不冲突——批量处理这件事本来就已经是 DATA_FLOW.md 之前就标出来"缺的一块"。
  DATA_FLOW.md 和 SHARED_INTERFACES.md 同步更新，要求以后写 `lib/shared/pipeline.ts`
  和 Supabase 持久化层的人必须遵守这几条规则。
- **明确排除的范围**：没有现在就去建 Supabase 表、没有现在就实现完整的
  `lib/shared/pipeline.ts` 业务逻辑——这些仍然是"地基之上的真功能"，规则和工具已经
  准备好，等负责人真正写这块代码时套用即可，不属于这次"检查架构合规性"的范围。

### 决策 20：团队分工从"按模块分给3人"改成"按技术层分给3人"

- **背景**：CLAUDE.md 和 TEAM_HANDBOOK.md 最初都按"3人各认领一个feature模块
  （classification/extraction/comparison）"设计协作流程和文件夹隔离规则（见决策3、
  决策7）。操作者说明实际分工是：**操作者一人做全部后端**（三个模块的
  `logic`/`api`/`mcp` 全部 + 公共区），队友A做UI/UX，队友B做README/slide/演示材料。
- **判断**：这个分法跟已经存在的 `logic/api/mcp/ui` 分层架构天然契合——操作者只碰
  `logic/api/mcp`，队友A只碰 `ui/`，两人几乎不会改到同一个文件，冲突风险比"按模块分"
  更低，不需要重新设计文件夹结构。
- **改了什么**：CLAUDE.md"各功能模块负责人"整节改写成"团队分工"，明确按层分；
  TEAM_HANDBOOK.md 第5.2节的"三人三模块"流程和角色示例标注为"分工方式变了、
  仅供参考"，第8节的认领表格改成按层填好（不再是空的"待认领"占位）。
- **唯一需要留意的协调点**：操作者和队友A之间的接口约定要走 `SHARED_INTERFACES.md`，
  操作者改了 `api/` 返回格式要记得同步更新；`README.md` 里"怎么装依赖/环境变量/
  部署步骤"这类技术细节会随后端改动而变，队友B主笔叙述性内容，但这类技术细节
  操作者这边改了要主动去同步，不能指望队友B自己猜对最新状态。

### 决策 21：官方Discord公告澄清 `ground_truth.json` 是特意给参赛者自测用的——更新决策14的判断

- **官方公告原文（操作者转述，@everyone 消息）**："the docker zip files in the info pack
  ground truth is for you to evaluate your models to be better ya. The readme part is
  just that we didnt update it long time ago. No need to worry about the content of
  us should not release to the participants. The whole content it is meant for you
  all to check your own work"——翻译大意：资料包里docker压缩包中的 ground truth，
  是特意给参赛者拿来自我评估模型效果用的，README里写着"不该发给参赛者"只是很久
  没更新的旧说法，不用担心，整份内容就是让参赛者拿来检查自己做得怎么样的。
- **对决策14的更新**：决策14当时基于"这份文件标注ORGANIZERS专用、疑似误发"的判断，
  定了"写代码时完全不读取/不参考这份文件内容"的自我约束。官方这条公告直接推翻了
  "误发"这个前提——所以这条自我约束**不再适用于"用于自测"这个场景**。
- **新的判断（保留的边界）**：官方说的是"评估模型、检查自己的工作"，不是"允许直接
  用这份文件的内容拼最终提交的 submission.json"。这两者性质不同：前者是拿真实答案
  当"期末模拟卷"检验pipeline准不准，是良性使用；后者是绕开真实的分类/抽取/比对逻辑、
  直接抄答案交上去，会导致"提交结果很漂亮，但系统本身其实不会处理没见过的邮件"，
  既违背比赛"做一个真正能用的系统"的本意，也在评分标准里 Working Core Prototype /
  Technical Feasibility 这些看"真实技术能力"的大头分数上有很高的翻车风险（比如决赛
  现场评委临时换一封邮件测试）。因此：**允许**写一个本地评估脚本，拿pipeline的输出
  跟 `ground_truth.json` 逐条比对算准确率，帮助改进真实逻辑；**不允许**任何直接把
  `ground_truth.json` 里的值写进最终提交文件的做法。

### 决策 22：引擎定为"规则优先 + Jev 判断 + LLM 兜底"的混合模式，引入内容指纹缓存与全量评测脚本

- **背景**：操作者要求尽量用"显式处理"（规则/关键词）避免消耗额度，有矛盾才用 Jev；Jev 官方最佳实践也支持"一次调用问完所有问题"（speculative fan-out，长材料只发一次）。
- **决策**：
  1. 分类：高精度模板签名优先（`classification/logic/rules.ts`），拿不准才交给 Jev（一次调用、choice 题）。
  2. 抽取：标签规则解析（`extraction/logic/label-parser.ts`，含提单 "To the Order of" 等全部版式变体），缺字段才用文本 LLM 兜底（prompt 明确"找不到填 null、占位符填 null"）。
  3. 比对：规范化（大小写/空白/标点/数字格式，`comparison/logic/canonical.ts`）后精确比；"文字字段对不上"的候选差异交给 Jev（一次调用、noul 题）复核；数字字段不进 Jev（实测 Jev 会把 "5 x 20'GP" vs "6 x 20'GP" 判成一样）。公司名与地址连成一串的版式（docx 常见）会先按"法律后缀（LTD/LLC/FZE…）"截断再比，纯格式差异不进 Jev。
  4. Jev 判定阈值统一为 **0.85**（操作者定的保守值）：分类置信度 < 0.85 → 标记人工复核；比对 noul < 0.85 → 判为不一致。用样例数据校准过：0.85 仍 0 漏报 0 误报（真实差异最高 0.52、真实一致最低 0.88），但再往上（如 0.9）会开始误报，**0.85 是上限，不要随意上调**。
  5. 缓存：`llm_call_cache` 表，键=sha256(用途+版本+provider+模型+实际发送内容)，写入用 upsert，存完整响应；没配 service key 时自动降级为不缓存。
  6. 增量：`verification_results.input_hash` + `PIPELINE_LOGIC_VERSION` 决定整封是否跳过；`LLM_CACHE_VERSION` 决定缓存是否失效。改引擎逻辑时必须手动 +1，见 SHARED_INTERFACES.md「编排层与混合引擎」。

### 决策 23：新增 results 模块（查询/统计/冲突对/导出），REST 与 MCP 共用一套逻辑；MCP 接上真实握手

- **背景**：操作者需要 5 件事都能被 MCP 和 GUI 用：①按分类查邮件 ②排序/自定义展示 ③统计
  （总数/失败数/各分类数）④冲突文件对 ⑤Save as（json/md/txt）。硬性要求是不在 MCP、
  REST、GUI 之间重复造轮子。当时 `verification_results` 已有 520 条真实结果（决策22写入）。
- **决策**：
  1. 新建 `app/features/results/`（logic/api/mcp，不做 ui，界面归队友A）；REST 和 MCP 都只调
     `logic/`，导出序列化只有一套；接口契约写进 SHARED_INTERFACES.md「results 模块」。
  2. 查询只读**数据库视图** `verification_overview`（`raw_emails` 左连接 `verification_results`，
     `security_invoker=true`）。原因：实测 PostgREST 的内嵌排序不影响父行顺序、内嵌筛选必须
     `!inner` 才不返回多余父行——扁平视图让筛选/排序/分页/统计稳定，不各自拼连接。
  3. `verification_results` 加 3 列：`processing_status`（ok/failed）、`error_message`、
     `defect_count`（生成列，自动等于 defect_fields 个数，用于排序/统计）。单封失败时由写库方
     标 failed（目前 `evaluate` 只写成功行，失败的行暂不落库）。
  4. 冲突文件对 = MISMATCH + NEEDS_REVIEW（操作者选的），带 SI/BL 路径和两边字段值。
  5. 导出 = `scope`（results/conflicts/stats/submission）× `format`（json/md/txt）；
     `submission` 只允许 json、导出官方纯格式，`X-Export-Incomplete` 提示是否覆盖全部邮件。
  6. MCP 用 Streamable HTTP 无状态 + JSON 模式（每请求新建 server/transport，Vercel 友好）；
     新增 4 个 tool，共 7 个；`app/core/mcp-server/route.ts` 不再是占位。
  7. 顺手修 Vercel 打包：`next.config.mjs` 加 `outputFileTracingIncludes`，把 `data/sample`
     打进 4 个运行时会用 fs 读样例数据的路由（否则线上 classify/extract/MCP 读不到文件）。
  8. 单一来源：类别/状态/原因的运行时清单收进 `lib/shared/types.ts`（类型从数组派生），
     `classification/logic` 改为引用，避免第二份清单。
- **验证**：tsc 通过；Turbopack 和 webpack 两种生产构建都通过；抽查打包清单确认
  data/sample 1544 个文件进入上述 4 个路由；对真实 520 条数据跑通 REST（列表筛选/排序/分组、
  统计、冲突 66 组、4 种导出、submission 520 条完整）和 MCP 客户端（握手 + 7 tools + 调用）。
- **验证结果（2026-09-20 首次全量评测，对照 `ground_truth.json`）**：分类 macro-F1 100%；端到端 520/520 完全一致；缺陷字段 TP=72 / FP=0 / FN=0；20 个 NEEDS_REVIEW 的 review_reason 20/20。本轮模型调用：比对 37 次 Jev（命中缓存后新增 0 条）、抽取兜底 0 次（规则全覆盖）；未配 Anthropic key 时兜底自动降级，不影响规则路径结果。

### 决策 24：整箱批量入口（REST + MCP）落地；顺带修掉两个服务端 PDF 相关的根因 bug

- **背景**：上一轮盘点里"还没做"的第一项——`runBatchPipeline` 只有本地 `npm run evaluate`
  用，云端/外部程序/AI agent 都触发不了整箱处理。操作者要求做成 REST + MCP，且重点是保证云端能跑。
- **决策**：
  1. 新建 `app/features/pipeline/`（logic/api/mcp）：`POST /features/pipeline/api` +
     MCP tool `run_batch`，共用一套 logic，不重复实现引擎；GET 同地址返回接口用法说明。
  2. 会写库的工具与只读工具区分：MCP 注解支持 per-tool 声明，`run_batch` 标
     `readOnlyHint:false`，其余 tool 维持只读默认。
  3. 参数：`email_ids` / `limit`（默认 50，1~520）/ `force` / `dry_run` / `provider` /
     `concurrency`（1~8）；Vercel 函数上限 60s，用 `limit` 分片，响应给 `remaining`。
     `dry_run` 不需要 service key（云端没配 service key 时也能预览），正式写库缺 key 返回 503。
  4. 结果表读写抽到 `lib/shared/verification-store.ts`，`evaluate` 和批量入口共用；失败邮件也写
     一行 `processing_status='failed'` + `error_message`（增量重跑时自动重试，不再只写成功行）。
  5. 样例邮件+附件解析抽到 `lib/shared/sample-inputs.ts`，**结果按 inbox 顺序返回**——
     `mapWithConcurrencyLimit` 的完成顺序会让"limit=前 N 封"每次挑到不同的邮件，破坏可复现性。
- **顺带修的两个真 bug（都是服务端 PDF）**：
  1. extraction 的 REST/MCP 一直用 `readSampleAttachmentText` 按 UTF-8 读附件 → PDF/xlsx/docx
     只能得到乱码/空结果（以前只测过 txt 所以没暴露）。统一改走 `readSampleAttachmentParsed`
     （按格式解析）；读不出文字时 REST 返回 422、MCP 返回可读错误。
  2. Next 打包器（Turbopack）会把 `pdf.mjs` 打进 server bundle 但不带运行时查找的
     `pdf.worker.mjs`，导致 Next 服务端解析 PDF 全部失败（实测报
     `Cannot find module .../pdf.worker.mjs`），批量入口会把 10 封 PDF 邮件误标 unreadable。
     修复：`next.config.mjs` 加 `serverExternalPackages: ['pdf-parse','pdfjs-dist']`。
- **验证**：tsc + 生产构建通过；本地 `next start` 与 Docker 镜像里 PDF/XLSX/DOCX 解析与抽取正常；
   tsx 与 Next 两个运行时算出的 `input_hash` 一致（API 增量跑 520/520 全跳过）；REST 的
   400 / 503 / dry_run / force / 失败行留痕都实测过；全量评测仍 520/520。

### 决策 25：引擎失败不再整封崩——分级降级链 + degraded 标记 + 一键重试（P0-2 / P1-5 / P1-9）

- **背景**：混合引擎任一环节（Jev / 文本模型）失败会直接抛错，整封邮件变成 failed 行；
  云端演示时断网、额度被限、供应商被挡都可能发生。操作者要求：Jev 挂了走 LLM、
  LLM 多家慢慢 fallback、全失败就"人工/失败标签 + 一键重试"。
- **决策**：
  1. 分类混合链改为逐级降级：规则（高置信）→ Jev（失败只记日志、继续）→ 文本 provider 链
     （首选最前，默认 gemini→deepseek→openai→claude→lmstudio，只试配了 key 的；
     实现在 `lib/shared/llm-chain.ts`，逐 provider 走同一套内容指纹缓存）→
     仍失败用"尽力规则"（分差 ≥1）降级，再无信号记 GENERAL。降级结果 `needs_review=true`、
     `engine=degraded`（写进 `model_provider` 列，供筛选/重试）。
  2. 显式指定 provider 的单独接口**不参与**降级链（选谁只试谁，避免"悄悄换模型装作成功"）。
  3. 比对：文字字段候选差异交 Jev 复核失败时，保守降级为"候选差异全部计入不一致"
     （与"没有 Jev key"时的既有口径一致，宁多勿漏），`engine=rules-degraded`；不整封失败。
  4. 一键重试：pipeline 的 REST / MCP 新增 `retry_failed`；服务端从结果表自动挑出
     `processing_status='failed'` 或 `model_provider` 含 `degraded` 的邮件并强制重算；
      不能和 `email_ids` 同用。GUI 接法见 UI_GUIDE.md 第二部分 §7。
  5. 失败原因只进服务端日志，不拼进用户可见响应；`needs_review` 不进官方提交格式。
- **验证**：tsc；全量评测 **520/520 完全一致**（分类 100%、缺陷 TP=72 FP=0 FN=0、
  复核原因 20/20）；正常数据全部由规则判出（rules=520），降级路径未被误触发。

### 决策 26：附件配对加"按内容识别"兜底（P0-3）

- **背景**：原来只按文件名 `_SI`/`_BL` 配对，改名/换名就误判缺附件（对手的"去文件名"实验证明
  这是全行业最脆弱的一环）。
- **决策**：配对顺序 = 文件名 →（有缺位时）对未占用、可读的附件按内容识别补缺：
  先复用 `document-identify.ts` 的关键词规则（import 上传模块同一份），规则判不出（UNKNOWN）
  才用文本模型链兜底（`document-identify-llm.ts`，模型只许从 SI/BL/OTHER/UNKNOWN 里选一个，
  输入只有文本片段）；同一附件不会被 SI 和 BL 抢两次；全失败维持缺位、走原有
  missing_attachment / unreadable 分支。不动"先判 OTHER 再判 SI/BL"的既有规则顺序。
- **验证**：tsc；全量评测 520/520 不变（样例数据仍全部由文件名配对命中，规则链对答案不乱动）。

### 决策 27：导出前做提交格式校验，fail-closed（P0-4）

- **背景**：官方 schema（`data/sample/README.md`）要求：MISMATCH 必带
  `defect_fields`/`has_defect=true`；NEEDS_REVIEW 必带 `review_reason` 且不得携带缺陷；
  OK 两者都为空。格式不对可能让好成绩白费，而且不允许"悄悄放过"。
- **决策**：`buildSubmissionDocument` 增加逐行一致性校验，违规 id 进 `invalidIds`；
  `incomplete` 判定追加 invalid 条件；HTTP 新增响应头 `X-Export-Invalid` /
  `X-Export-Invalid-Ids`；MCP `export_results` 的 `_meta` 同步 `invalid` / `invalid_ids`。
  导出照常返回文件（方便定位修复），但完整性告警必须可见。
- **验证**：tsc；头与 `_meta` 已接线；全量评测 520/520（当前 0 条 invalid）。

### 决策 28：数值"精确/模糊"只用于冲突查询，不进官方提交（P1-6）

- **背景**：操作者要"精确比和模糊比都要，筛选搜冲突文件时可选、可输入"；同时
  FINALS_ROADMAP 3.5/4.4 依据官方生成器与评分脚本，明确官方差异量级大（重量 ±500~2000kg）、
  提交路径加容差会漏检，故提交判定保持精确。
- **决策**：results 的 conflicts 查询新增参数：`numeric_mode=exact|fuzzy`、
  `tolerance`（≥0，仅 fuzzy 可用）、`value_field`（container_count / gross_weight_kg）、
  `value`（按值搜索，命中 SI/BL 任一侧；必须与 value_field 成对）。
  模糊口径下差值 ≤ 容差的数字字段不再算冲突（默认容差：重量 max(0.5kg, 0.1%)、箱数 0）；
  实现为逻辑层过滤（`numeric-query.ts`），不改存储判定；REST + MCP 同参，conflicts 导出同样支持。
- **验证**：tsc；参数非法返回中文 400；该功能只影响查询层，不影响全量评测口径。

### 决策 29：字段级出处落库（P1-7）

- **背景**：此前结果只有整封文件指纹，回答不了"这个值是从哪一行抽出来的"。
- **决策**：规则解析返回每个字段的命中行号 + 原句（`parseDocumentFieldsWithEvidence`），
  LLM 兜底字段只标 `source=llm`（不给假出处）；沿 pipeline 透传，结果表新增两列
  `evidence_si` / `evidence_bl`（jsonb），视图 `verification_overview` 同步追加；
  results 列表与冲突对返回 `evidence_si/bl`、`si_evidence/bl_evidence`。
  DDL 已同步 `scripts/phase3-evidence-migration.sql`；表结构变更经操作者确认（2026-09-21）。
- **验证**：tsc；迁移已应用并核实视图列；全量评测 520/520 不变。

### 决策 30：`callLLM` 加同 provider 内自动重试一次，不动跨 provider 降级链（P1-2）

- **背景**：操作者要求"LLM 可以增加自动重试，但是不能忽略 fallback"——之前 `lib/llm/index.ts`
  的 `callLLM` 单次调用 20s 超时后直接失败，完全靠 `lib/shared/llm-chain.ts` 换下一个 provider
  兜底；但有些失败是纯粹的临时抖动（网络毛刺、上游一次性 5xx），换 provider 之前先原地重试一次
  更省事，也更符合"这次大概率会好"的直觉。
- **决策**：`callLLM` 内部对超时（`isTimeoutError`）、限流（429）、上游 5xx、网络错误这四类
  "重试大概率有用"的失败，等 2 秒后原样重试一次；对 401/403（认证错误）、400/422（请求本身不合法）
  这两类"重试也不会变好"的失败不重试，直接抛出。只重试一次，不递归、不无限循环。
- **两层降级关系（不是二选一，是叠加）**：`callLLM` 内部重试解决"同一个 provider 抖一下"；
  `lib/shared/llm-chain.ts` 的跨 provider 降级链解决"这个 provider 真的不行，换下一个"；
  两者顺序是先重试、重试也失败才换 provider，最后才是分类/比对各自的 `degraded` 兜底
  （决策25）。`callJev` 不加这层重试，失败仍直接交给上层混合引擎转下一级，因为 Jev 的失败处理
  策略本来就是"换引擎"而不是"同引擎再试一次"。
- **验证**：`npm run typecheck` 通过；对外错误契约不变（仍是 `LLMConfigError` /
  `UpstreamServiceError` 两种），重试过程只进 `console.warn`，不改变响应内容。

### 决策 31：人工复核闭环后端落地（REST+MCP，四模块），GUI 留给队友A（P1-1）

- **背景**：`docs/REVIEW_SPEC.md`（2026-09-20）设计已定但一直没实现——题目第④条"拿不准提示人工"
  只做到"提示"，没有处置闭环。操作者要求"做完他，留好接口，GUI别做"。
- **落地范围**：共用层 `lib/shared/review/`（`types` / `store` / `actions` / `normalize` / `merge` /
  `rerun` / `http` / `mcp`，8 个文件）+ `scripts/review-schema.sql`（`review_overrides` 当前生效结论、
  `review_actions` 只增审计日志，两表 upsert/insert 写、anon 只读）+ 四个模块各 4 个 REST 路由
  （`api/review/{route,history,undo,bulk}.ts`）+ 4 个 MCP tool（`list_<m>_review` /
  `get_<m>_review_history` / `apply_<m>_review_action` / `undo_<m>_review_action`，共 16 个，写
  tool 都标 `readOnlyHint:false`）+ results 导出接线（`applyOverridesToSubmission`，只有
  `scope=submission` 套用覆盖，新增 `X-Review-Pending`/`X-Review-Deferred` 响应头）。
- **与 REVIEW_SPEC 的三处偏差（已登记在该文件第15节）**：
  1. 没建 httpOnly cookie 会话（`admin-session.ts`）——这套机制只有 GUI 会用到，这轮不做 GUI，
     REST/MCP 沿用和其余模块一致的 `x-admin-token` 请求头方式，等做 GUI 时再补，避免"为不存在的
     需求预先设计"。
  2. classification 的复核队列目前只覆盖"全模型失败降级"，不覆盖"Jev 置信度<0.85 但没失败"——
     后者这个信号目前只在单文档接口即时返回，没有持久化进 `verification_results`，要补齐需要单独
     加一列（涉及表结构变更，需要操作者确认，不在本轮范围）。
  3. MCP 没做独立的 bulk tool（批量只走 REST）——这个其实符合 REVIEW_SPEC §8 原定的 4 个 tool，
     不算偏差，这里一并记录说明。
- **实测中发现并修了一个真实 bug**：`lib/shared/review/store.ts` 的 `listOverrides` 最初用 PostgREST
  的 `.in("email_id", emailIds)` 查询；submission 导出一次传几百个 email_id 进来，拼进 URL 查询参数
  直接被 PostgREST 判 400 Bad Request（本地实测复现）。根因是 URL 长度限制，不是权限/数据问题——
  `review_overrides` 表本身很小（只有"被人工处理过的一小撮"），改成不带 `.in()` 条件、按
  `target_kind` 整表取回再在内存过滤，问题消失，也更贴近这张表的实际规模。
- **验证**：本地 `next dev` 对 `comparison` 模块实测 confirm/correct/undo/bulk（含故意传一个不存在的
  `email_id`，验证批量失败隔离能返回 `{succeeded, failed}` 而不整批失败）/ 乐观锁冲突 409 /
  一致性校验 400（MISMATCH 不带缺陷字段被拒）/ 撤销后正确回滚 / 提交导出的 `X-Review-Pending`
  `X-Review-Deferred` 头随人工动作实时变化，全部通过；测试数据用完已从 `review_overrides`/
  `review_actions` 清空，没留在共享数据库里。`npm run typecheck`、`npm run build`（16 个新路由都
  正常生成）、`npm run test:mcp-annotations`（写 tool 白名单已加 8 个新条目）均通过。
