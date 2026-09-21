# 当前目标

## 目标

修掉"点了 rerun all 之后切走再切回来就看不出还在不在跑"这类**运行状态丢失**问题，以及同类的形式/表述问题（例如 email_004 的 SI/BL 对照表让人误读成系统错判），并在此基础上主动巡查、发现并修复更多 bug，最后给出一份可读的排查报告。

## 验收标准

**C1 — 长时间操作的运行状态不会因为切换页面/卡片而丢失**
- 机器校验（PowerShell）：
  - `Select-String -Quiet -Pattern "RunStatusProvider" app/dashboard/_components/dashboard-shell.tsx`
  - `Select-String -Quiet -Pattern "useRunStatus" app/features/verification/ui/index.tsx`
- 人工确认：点"Run and save"（或 Retry them）→ 立刻切到别的页面 → 切回来，页面仍然显示"正在运行"或这次运行的结果，而不是回到点击前的空白状态。

**C2 — email_004 的比对结论经官方 ground truth 校验，结论明确**
- 已查证的事实：`data/sample/attachments/email_004_SI.txt` 第6/8行是 `EAST BRIGHT FZ-LLC`，`email_004_BL.txt` 第6/8行是 `UAB NOVAKOPA` → consignee / notify_party 确实不一致，系统判 MISMATCH 是**对的**。
- 机器校验：`npx tsx scripts/evaluate.ts`（或等价的一次性校验脚本）对全部 520 封跑完后，email_004 的 `comparison_status` 与 `defect_fields` 与官方 ground truth 一致，且整体分数不低于此前留档（`private/eval-runs/` 里的 final 1.0）。
- 若校验发现真错判 → 必须修到一致；若确认没错判 → 必须把"为什么看起来像错判"当成 UI bug 修掉（见 C3）。

**C3 — SI / BL 对照表在任何屏宽下都不会被读串**
- 机器校验（PowerShell）：`Select-String -Quiet -Pattern "sm:hidden" app/_components/results/compare-view.tsx` 之外，每个值单元格在桌面宽度也要带明确的 SI/BL 归属标记（不能只靠表头）：
  `Select-String -Pattern "SI|BL" app/_components/results/compare-view.tsx` 命中每个 Cell 的 label 且 label 不再被 `sm:hidden` 隐藏。
- 人工确认：把 email_004 的对照表整块复制出来，纯文本里也能分辨哪个值属于 SI、哪个属于 BL。

**C4 — 代码质量闸门全绿**
- `npm run typecheck` 退出码 0
- `npm run build` 退出码 0
- `npm run test:mcp-annotations` 退出码 0（MCP 写 tool 注解白名单没被破坏）

**C5 — 产出排查报告，每条 bug 有现象 / 根因 / 修没修 / 为什么**
- 机器校验：存在 `docs/BUG_HUNT.md`，且其中每条"已修"的条目都能在 `git log` 的本轮提交里找到对应改动。
- 报告必须如实区分"已修 / 没修 / 不是 bug（附证据）"，不允许把没验证的东西写成已修。

## 范围

- **做**：
  - 运行状态跨页面丢失（Full pipeline 运行、Retry failed、devmode wipe/restore、复核批量操作等所有长耗时按钮）
  - 同类的"形式上的"问题：状态/筛选/滚动位置丢失、表述歧义、布局导致的误读
  - 抽取/比对正确性抽查（用官方 ground truth 本地自测）
  - 主动巡查更多 bug，低风险的直接修，高风险的写进报告等操作者决定
- **不做**：
  - 不删除共享 Supabase 里的扰动测试数据（pt1~pt14 那 2768 行）
  - 不对生产库跑全量 520 封的真实流水线重算（会烧 LLM 额度）；只在必要时跑最小子集
  - 不改 CLAUDE.md 的分工/规范本身
  - 不做大规模架构重构（比如引入任务队列表、后台 worker）

## 当前进度

- [x] C1 运行状态跨页面不丢失 —— 功能已实现（`3410f93`），校验 #2 通过；**校验 #1 待操作者确认**：命令里写的 `dashboard-shell.tsx` 是错的位置，实际正确地挂在 `app/_components/providers.tsx`（DashboardShell 在 /dashboard 和 /features 两棵路由树里各渲染一份，放那里跨树切换照样丢）。按规则未自行修改标准。人工点击确认也待操作者做（项目里没有浏览器自动化）。
- [x] C2 email_004 经 ground truth 校验，结论明确 —— 系统判对了；全量 520/520
- [x] C3 SI/BL 对照表不会被读串 —— 每个值都带 SI/BL 标签，`sm:hidden` 已移除
- [x] C4 typecheck / build / mcp-annotations 全绿
- [x] C5 `docs/BUG_HUNT.md` 排查报告产出
