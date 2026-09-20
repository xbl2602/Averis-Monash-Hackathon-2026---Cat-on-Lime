-- 第二阶段 4 张表的 RLS（PHASE2_SPEC 第 1 节；2026-09-20 安全评审 B4）
-- 用法：Supabase 控制台 → SQL Editor → 全部粘贴执行；可重复执行（第二次起输出只剩 NOTICE）。
-- 执行后按 README「数据库初始化（新环境/换项目必读）」做一次 anon 只读探测。
--
-- 范围说明：
-- - 本脚本只处理第二阶段 4 张表（app_config / mail_accounts / supabase_projects / uploaded_documents）。
-- - 主三表（raw_emails / parsed_attachments / verification_results）、只读视图 verification_overview、
--   缓存表 llm_call_cache 的 DDL 与 RLS 不在本仓库，需从现有 Supabase 控制台导出后补进 scripts/；
--   其中 **verification_results / verification_overview 必须保留 anon select 策略**，
--   否则 results 的 list/stats/conflicts/export 与 pipeline 的增量读取会全部失败。
-- - 策略名固定为 uploaded_documents_anon_select；如果控制台里手工建过别的名字的 anon 策略，
--   本脚本不会替换它（permissive 策略叠加不危险，但请以控制台实际策略为准记录）。
-- - `alter table if exists` 对不存在的表输出 NOTICE 后跳过；下面的 do 块用 to_regclass 守卫，
--   避免对不存在的表执行策略语句直接报错。

alter table if exists public.app_config enable row level security;
alter table if exists public.mail_accounts enable row level security;
alter table if exists public.supabase_projects enable row level security;
alter table if exists public.uploaded_documents enable row level security;

-- uploaded_documents：代码用 anon key 读列表/详情（见 import/logic/document-store.ts），
-- 所以只给它一条 select 策略；其余三表不给 anon 策略（API 读走 service role，绕过 RLS；
-- anon 经 PostgREST 一律被拒）。
do $$
begin
  if to_regclass('public.uploaded_documents') is not null then
    drop policy if exists "uploaded_documents_anon_select" on public.uploaded_documents;
    create policy "uploaded_documents_anon_select"
      on public.uploaded_documents for select to anon using (true);
  end if;
end $$;
