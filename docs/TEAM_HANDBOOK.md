# 团队执行手册 — Averis x Monash Hackathon 2026

给团队3人看的分工/协作手册。技术细节遵循 [CLAUDE.md](../CLAUDE.md)（3人的 Claude Code 都会自动读取那份文件），核心决策的来龙去脉见 [DECISION_LOG.md](DECISION_LOG.md)。

## 0. 现状快照

- 团队：3人，都没有编程背景，都用过 AI 编程工具，都没有比赛经验
- 协作模式：**3人各自开自己的 AI coding session 并行开发**，靠 Git 仓库整合
- 题目：**9月18日**公布才知道，现在还不知道要做什么
- 提交截止：**2026-09-22 12:00pm**

✅ 报名、GitHub 仓库、Discord 频道、每人环境搭建与最小验证均已完成（原第4节对应项已移除）。

题目公布前，这份手册只能先定"通用的准备和流程"，具体项目内容等题目出来当天立刻补第8节。

## 1. 关键时间线（2026-09-18 开幕式后更新，详见 [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md)）

| 时间 | 事项 |
|---|---|
| ~~9/17 18:00 前~~ | ~~报名截止~~ ✅已完成 |
| **9/18（今天）** | **题目正式公布**：航运单证核验（Shipping Documents Verification），见第8节 |
| 9/18 – 9/22 中午 | 开发冲刺 |
| 9/20 | **Workshop 1**（讲者：Sharik、Darren）——排计划时留出时间参加 |
| 9/21 | **Workshop 2**（讲者：Averis）+ 建议当天开始功能冻结、整合、debug、准备演示素材 |
| 9/22 上午 | 录视频、写slide、最终检查 |
| **9/22 12:00pm** | **初赛提交截止（Google Form）**——已用倒计时核对过，时间没有出入 |
| 9/24 | 初赛选出前10名队伍名单公布 |
| 9/26（⚠️见下方说明） | 决赛：现场10分钟路演 + 5分钟Q&A，地点 **Monash University Malaysia，Bandar Sunway, Subang Jaya**，**全员必须physically到场** |

⚠️ 决赛日期在开幕式转录里出现过一次"26号"一次"20号"，按逻辑（10强名单9/24才公布，决赛不可能在这之前）26号更可信，但建议去 Discord 核实官方公告后再定，不要直接按这里排后续行程。

## 2. 赛事背景与合作方定位（调研结果，非官方文档原文）

这部分不在官方 Rules and Regulations 里，是调研补充的背景，帮助判断题目可能的方向。**带"未证实/推测"标注的地方请勿当作确定信息使用，题目公布后以官方为准。**

### 2.1 主办方是谁
- **Averis Sdn Bhd**：马来西亚的全球商业服务（GBS）公司，2006年成立，总部在吉隆坡 Bangsar South，主要为 **RGE Group**（Royal Golden Eagle，Sukanto Tanoto 旗下的造纸/棕榈油/粘胶纤维/能源集团）提供服务。核心业务：IT外包、HR、财务与会计、航运单证（Shipping Documentation）、数字化/RPO/变革管理。
  - 之前调研中"Averis 可能和 Sunway 集团有关"的猜测**已被证伪**，两者没有关联。
  - **没有证据显示 Averis 是某个云厂商（AWS/Azure/GCP）的代理商或有绑定关系**，选云平台不用刻意迎合他们。
  - 由此推测（**未证实**）：题目大概率偏向**企业后台/供应链场景**——比如 HR 流程自动化、财务对账、航运/物流单证处理、企业内部数字化工具，而不是面向大众消费者的社交/电商类应用。找到一条另一场 Averis 参与过的黑客松（与 Ace Resource Advisory 合办）主题是**供应链/IoT**，进一步支持这个方向的猜测，但**不能确认是同一系列**。
  - ✅ **这个推测已被9/18公布的官方题目证实**：题目就是航运单证核验（Shipping Documents Verification），细节见第8节和 [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md)。
- **Monash University Malaysia**：确认是 Monash 马来西亚校区（Bandar Sunway），由 School of IT 主办，不是 Monash 澳洲总部。该校有活跃的 GDG on Campus（Google Developer Group）学生社团，且校方是 **Microsoft Azure Dev Tools for Teaching** 项目成员——没找到 AWS Academy 或 Huawei Cloud 的合作证据。**没有证据显示比赛强制或偏好某个云平台**。

### 2.2 是否有往届记录
- 搜索不到"Averis x Monash Hackathon"这个具体名字的往届（2024/2025）——**这大概率是第一届**，没有历史赛题/获奖名单可参考。
- 论坛/社媒（Lowyat.NET、Reddit、Facebook、X、TikTok）上**没有找到关于这场比赛的实质讨论**，组队帖、吐槽、攻略基本没有——信息只能靠官网和 Discord。

### 2.3 赛制细节（补充官方文档没写清楚的部分）
- 奖金池 **RM 9,000**：冠军 RM5,000 / 亚军 RM3,000 / 季军 RM1,000
- 只有**一个统一密封题目**，不是多赛道选题——不用纠结"选哪个track"
- 初赛后**前10名队伍**进决赛，现场做 **10分钟路演 + 5分钟Q&A**
- 面向所有大学生（不限 Monash 学生）
- 两份详细评分细则 Google Docs（[初赛](https://docs.google.com/document/u/0/d/1EiI_mqJYeMN0D-dtZ_npCavVGXVcePFmcZ7O4d4ygQI/edit)、[决赛](https://docs.google.com/document/u/0/d/1S-bLf45JOabMl1QUDgl4F6NTwuwD7UKbhPKh74sqaRo/edit)）需要登录 Google 账号才能看到完整内容，调研工具打不开，**建议尽快用自己的 Google 账号手动打开看一遍完整评分细则**，可能比图表里的大类项更详细。
- 没找到其他赞助商/导师名单，目前看只有 Averis 一家主办企业。

## 3. 评分对齐（把力气花在刀刃上）

来自 [Rules and Regulations.md](Rules%20and%20Regulations.md) 里的评分图表，两轮里权重最高的都是"能不能跑起来"：

**初赛（100分）**：Working Core Prototype 25 分（最高）、System Design & Architecture 15、Technology Integration 15、Technical Feasibility & Validation 15、Problem Statement Understanding 10、Innovation & Solution Approach 10、Practical Value & Potential 10

**决赛（100分）**：End to End Functionality 25 分（最高）、Architecture & Scalability 15、Technology Integration 15、Engineering Quality & Robustness 15、Solution Effectiveness & User Value 10、User Experience & Differentiation 10、Impact & Future Potential 10

**结论**：
- 优先保证**一条完整能跑的核心流程**，而不是做很多半成品功能，或者纠结花哨的 UI。
- "Technology Integration" 两轮都占 15 分，指的很可能是 AI + 云基础设施是否**真正整合进核心功能**（而不是摆设），规则原文也强调"未能有意义整合云基础设施可能被大幅扣分"——AI 和云部署不是加分项，是硬性及格线。
- 团队零编程经验的情况下，`Engineering Quality & Robustness`（决赛15分）容易失分，第5节的协作规则就是为了尽量保住这块分。
- 调研东南亚同类AI黑客松的获奖项目（如 APU 拿下 Great Malaysia AI Hackathon 2025 冠军的"InsureScan"保险单据AI识别、"FundSight AI"中小企业拨款匹配）发现一个共性：**赢的项目都很"窄"**——一个具体垂直问题 + 一个评委30秒内就能看懂的核心AI功能，而不是大而全的平台。常见翻车点是功能贪多、或者demo依赖一个可能在台上挂掉的实时API（建议准备缓存/预设的演示数据做保底）。

## 4. 赛前准备清单（现在 – 9/18 之前完成）

- [ ] 提前定好"默认技术栈"（见下），减少题目公布当天的决策瘫痪
- [ ] 提前申请云/AI额度，别等到比赛当天现申请：
  - [ ] [AWS Educate](https://aws.amazon.com/education/awseducate/)（免信用卡）
  - [ ] Azure for Students（约 $100 额度）
  - [ ] Google Cloud 免费层/教育额度
  - [ ] **直接去 Anthropic 官网申请 Claude API 额度**（注意：从2026年3月起 GitHub Student Pack 已经不再直接给 Claude Opus/Sonnet 模型权限，只有 Haiku，不要依赖学生包拿 Claude 用量）
- [ ] 手动登录 Google 账号打开两份评分细则 Google Docs（见第2.3节链接），看看有没有官方图表里没写的细节
- [ ] 把这份手册和 `CLAUDE.md` 提交到仓库根目录
- [ ] 每人想清楚自己的"天然强项"（沟通表达 / 审美设计 / 写作文档 / 逻辑测试），供 9/18 拆功能模块时参考——不是技术分工，是"谁适合盯哪块"

### 技术栈（已确认，不是临时默认）

团队正式确定用**最省运维、AI最容易生成对的代码**的组合，而不是最"专业"的组合。这个组合也在调研中被验证为2026年AI编程工具圈公认的"低幻觉率"标准搭配（因为文档/训练数据里这个组合最常见，AI写起来出错最少）：

- 前端 + 部署：**Next.js**，部署到 **Vercel**（已确认——免费、git push 即部署、不用碰云控制台、AI 生成的 Next.js 代码质量普遍最高）
- 后端/数据：**Supabase**（已确认——托管 Postgres 数据库 + 鉴权 + 存储，不用自己搭服务器，清楚地满足"云基础设施"要求）
- AI 能力：**多 LLM**（Claude / ChatGPT / DeepSeek / Gemini / 本地 LM Studio，都通过 Vercel AI SDK 统一调用），作为产品核心功能的一部分——具体要求见 [CLAUDE.md](../CLAUDE.md)"多LLM支持"节

技术栈已经定案，不用再等题目细节变化去调整。

## 5. 协作流程（通用，不依赖具体题目）

### 5.1 Git 分支模型

调研明确指出：**目前没有任何AI编程工具会自动处理多人同时改同一批文件产生的合并冲突**（Claude Code、Bolt.new 都不例外），3人真的同时改同一个文件是冲突高发区，必须靠流程规避，而不是指望工具兜底：

- `main` 分支任何时候都要保持"能跑"，只能通过 Pull Request 合并进去，不要直接往 main 推跑不起来的代码
- 每人在自己的分支上工作：`姓名/任务简述`（比如 `alex/login-page`），**只改自己认领范围内的文件夹**（对应第5.2节"一切皆插件"的文件夹划分）
- **小步高频提交**：写出一小块能跑的东西就 commit + push，不要攒一整天的改动才提交——大改动堆在一起会很难合并
- 每天开始工作前先拉一下 main 的最新代码，避免越改越偏
- **每天安排一位"当值集成员"**（3人轮流），负责当天把大家的 Pull Request 合并进 main
- 避免"三个人同时对着同一个文件各自发指令给AI"——这是文档里反复强调的头号翻车原因

### 5.1.1 具体怎么操作（新手向：全程用 GitHub Desktop，不用打命令行）

三人都没用过 Git，**强烈建议用 [GitHub Desktop](https://desktop.github.com/) 这个图形界面工具**，全程点按钮完成，不需要背命令。Claude Code 虽然也能直接帮你跑 git 命令，但**不要完全交给它无监督操作**（原因见下面的安全提醒）——用 GitHub Desktop 做分支/提交/推送/合并的"最终把关"，Claude Code 用来写代码和解释冲突。

**每天的固定流程：**

1. **开始工作前**：打开 GitHub Desktop，点 **Fetch origin** 再点 **Pull**，把 main 上其他人的最新代码拉下来
2. **建自己的分支**：顶部 **Current Branch → New Branch**，取名 `你的名字/今天做的功能`
3. **写代码**：正常用 Claude Code 干活
4. **随时小步提交**：做出一小块能跑的东西，就在 GitHub Desktop 左下角写一句话描述改了什么，点 **Commit**
5. **推送**：点 **Push origin** 按钮，把提交传到云端（每次告一段落、至少每2小时一次）
6. **功能做完一小块，开一个 Pull Request**：顶部 **Branch → Create Pull Request**，会自动打开浏览器里的 GitHub 网页，填个标题就能提交
7. **当值集成员**在 GitHub 网页上检查一下这个 PR，没问题就点 **Merge pull request**
8. **其他人**再重复第1步（Fetch → Pull），把合并进 main 的最新代码拿回自己电脑

**遇到合并冲突时（文件里会出现这样的标记）：**

```
<<<<<<< HEAD
你的版本
=======
队友的版本
>>>>>>> 对方分支名
```

1. GitHub Desktop 或 VS Code 会提示这个文件"冲突"了，打开它
2. 如果用 VS Code 打开，代码上方会有 **Accept Current Change / Accept Incoming Change / Accept Both / Compare Changes** 几个按钮，点你想保留的那个
3. 确认文件里没有残留的 `<<<<<<<` `=======` `>>>>>>>` 符号（有的话手动删掉）
4. 也可以**把整段冲突内容复制给自己的 Claude Code**，问"这两段代码冲突了，帮我合并，尽量保留双方的改动，并解释你是怎么合的"——**读一遍它的解释再接受，不要看都不看就点 Accept Both**
5. 保存文件，回到 GitHub Desktop，勾选这个文件表示"已解决"，正常 Commit + Push

**⚠️ 用 AI 编程工具操作 Git 时的安全提醒（真实发生过的翻车案例）：**

- **每次让 AI 开始一个新任务之前，先手动 Commit 一次**，留一个"改动前"的干净快照——这样万一 AI 改坏了，还能退回去
- **不要两个人的 AI 同时改同一个分支**
- AI 给出的冲突合并结果，**先看一眼改了什么再接受**，不要无脑确认
- 如果 AI 把东西改坏了，**用 GitHub Desktop 里图形化的"Discard changes"按钮撤销**，不要跟 AI 说"帮我清理一下/reset一下"——已经有真实案例是这种模糊的说法让 AI 跑出了 `git reset --hard` 这类会**永久清空未提交改动**的破坏性命令

### 5.2 拆模块：一切皆插件（题目公布当天第一件事，30-60分钟内完成）

团队定的核心架构原则是**"一切皆插件"**——项目分成一个很薄的"核心骨架"（导航、布局、共享配置）加上若干个**自包含的功能模块**，每个模块自己一个文件夹，尽量不碰别人的文件夹。这个约定已经写进 [CLAUDE.md](../CLAUDE.md)，3人的 AI 都会自动遵守，具体目录结构见那份文件。

选这个架构不是为了"看起来专业"，是直接对着你们的两个真实痛点来的：

- **3人同时用AI并行开发怎么不冲突** → 每人的功能活在自己的文件夹里，物理上很难和别人冲突，冲突只会发生在少数"公共区"文件，改公共区之前群里说一声就行
- **决赛必须是初赛的延伸，不能推倒重做** → 决赛加新功能＝再建一个功能文件夹，不用大改已有代码，"延伸"这件事变得很自然

**实际分工（已确认，按层分，不是按模块分）**：跟本节最初设想的"每人认领一个feature模块"不一样，团队实际是按技术层分工——

- **操作者**：全部后端功能——`classification`/`extraction`/`comparison` 三个模块的 `logic/`、`api/`、`mcp/`，加上 `/app/core`、`/lib` 公共区
- **队友A**：UI/UX——三个模块的 `ui/` 文件夹 + 全局布局导航
- **队友B**：README、slide、演示材料——不碰代码

这个分法跟 `logic/api/mcp/ui` 分层架构天然契合，操作者和队友A几乎不会改到同一个文件。两人之间唯一要对齐的是 `SHARED_INTERFACES.md` 里写的接口格式——操作者改了 `api/` 的返回格式，要同步更新这份文件，队友A的AI才知道要跟着调整界面。

（下面是原本按模块分工时的流程参考，现在按层分工后不完全适用，仅供以后如果分工方式再变时参考）：

1. 3人一起（可以各自先让自己的 AI 帮忙分析题目）讨论产品方案
2. 把项目拆成**尽量独立、各自一个文件夹**的功能模块——具体怎么拆取决于题目，但拆分标准是"这块东西能不能基本独立运行、不太需要频繁调用别的模块内部细节"
3. 如果某个功能必须用到别人负责范围内的东西，先在 `SHARED_INTERFACES.md` 里写清楚"我需要什么格式的数据/接口"，而不是让自己的 AI 直接跑去改/读别人负责范围内的实现细节

### 5.3 AI 使用规范

- 3人的 Claude Code（或其他工具）都读取仓库根目录的 [CLAUDE.md](../CLAUDE.md)，保证代码风格、目录结构一致
- 开始一项任务前，在 `#开发` 频道说一句"我要做xxx"，避免两人重复做同一件事
- 完成一个可运行的小功能就 push，让队友的 AI 在集成时能读到最新代码
- **AI 生成的代码如果你自己看不懂，直接追问 AI"这段在干嘛"**，尤其是会影响别人模块的部分（共享的数据结构、接口格式），不要盲目接受
- 涉及"别人模块会用到"的接口变动，先写清楚（可以用一个 `SHARED_INTERFACES.md`）再改，别人的 AI 才知道要跟着调整

### 5.4 同步机制

- 建议每天至少2次15分钟语音同步（例如中午+晚上），过一遍：昨天做完了什么 / 今天要做什么 / 卡在哪需要帮忙
- 用 Discord 置顶消息或共享文档实时记录"谁在负责哪个模块"

## 6. 冲刺阶段模板（占位，9/18 拿到题目后细化）

- **Day 1 (9/18)**：头脑风暴 + 定方案 + 拆模块 + 每人先跑出一个最基本的骨架（哪怕只是空页面能部署上线）
- **Day 2-3 (9/19-9/20)**：主力开发冲刺，每天至少集成一次
- **Day 4 (9/21)**：**功能冻结**（不再加新功能），开始整合、debug、准备演示素材、准备API失败时的备用数据
- **Day 5 上午 (9/22)**：录视频、写 slide、最终检查提交清单，中午12点前提交

## 7. 提交前检查清单（依据 [Rules and Regulations.md](Rules%20and%20Regulations.md)）

- [ ] Project Description（项目名称、目的、要解决的问题）
- [ ] Demo Video（**≤5分钟**，每超30秒扣1分；YouTube unlisted/public 均可，不能 private；Google Drive 需设为 "Anyone with the link → Viewer"）
  - [ ] 视频内容覆盖：团队&项目名 / 问题是什么&影响谁 / 技术栈 / 现场演示 / 影响力(数据或用户反馈)
- [ ] GitHub 仓库链接，README 含清楚的安装说明
- [ ] Live Prototype 可公开访问链接，**judging 期间必须保持在线**
- [ ] Slide Deck / 文档链接，包含：技术架构、实现细节、遇到的挑战、未来规划
- [ ] Google Form 所有字段填完整（团队名、代表联系方式等）

## 8. 项目内容（2026-09-18 题目公布后更新）

- **问题陈述**：Averis 航运操作团队每天在同一邮箱收到约2000封邮件（托运指示SI、提单BL确认、发票询问、垃圾邮件混杂），需要把 BL 草稿和对应的 SI 逐项核对到完全一致才能定稿，人工核对重复且容易出错。系统需要做到：① 分类邮件类型 ② 从正文/附件抽取关键字段（shipper、consignee、notify party、port of loading、port of discharge、container count、weight）③ 比对 BL 与 SI 字段、标出差异 ④ 拿不准时主动提示需要人工介入。完整细节、样例数据说明、评分标准见 [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md)。
- [ ] 项目名称（还没定，建议今天讨论定下来）
- **最终技术栈**：官方确认无限制，沿用第4节确定的组合（Next.js + Supabase + Vercel + 多LLM，具体见 [CLAUDE.md](../CLAUDE.md)），已够用
- **功能模块拆分**：按官方给的三个步骤拆成三个 feature（已写进 [CLAUDE.md](../CLAUDE.md)），代码结构按模块分成 `classification`/`extraction`/`comparison`，但**人力分工是按层分，不是按模块分**（见第5.2节）：
  - [x] 后端（三个模块的 `logic`/`api`/`mcp` 全部 + `/app/core`、`/lib` 公共区）—— 认领人：操作者
  - [x] UI/UX（三个模块的 `ui/` + 全局布局导航）—— 认领人：队友A
  - [x] README / slide / 演示材料 —— 认领人：队友B
- [ ] 详细 Day-by-day 任务清单（认领模块后，各自在自己的 AI session 里细化）
- **写slide deck"未来规划"部分时可以用的素材**：公开demo目前用云端LLM（Vercel没有GPU、跑不了本地大模型推理），未来如果要支持自己部署的开源模型，可以另外接一台GPU云主机（RunPod/Together.ai等）跑推理服务，网站代码指过去调用即可——这条不用真的实现，写进slide展示"想清楚了怎么扩展"就有加分（对应决赛评分里的 Architecture & Scalability / Impact & Future Potential）

## 附：调研中明确没找到/未证实的信息

避免团队把下面这些当成事实使用：

- Averis 与 Sunway Group 的关联 —— **未证实，大概率是错的**（Averis 实际隶属 RGE Group）
- 这场比赛的往届记录（2024/2025）—— 未找到，推测是第一届
- Monash Malaysia 是否有 AWS Academy / Huawei Cloud 合作 —— 未找到证据
- Averis x Monash 是否有专属赞助商云额度/福利 —— 未找到，建议直接问 Discord/主办方
- ~~决赛现场路演具体日期、地点（校区）——官方未公布~~ ✅**地点已确认**：Monash University Malaysia, Bandar Sunway, Subang Jaya。**日期存疑**：开幕式转录里一次说26号一次说20号，需去 Discord 核实
- 参赛队伍总数 —— 未找到
- 除 Averis 外的其他赞助商/导师名单 —— 未找到
