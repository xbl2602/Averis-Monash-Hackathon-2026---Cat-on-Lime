-- 核心三表 + 只读视图 + 模型调用缓存表（P0-1，2026-09-21）
-- 用法：Supabase 控制台 → SQL Editor → 全部粘贴执行（幂等，可重复执行）。
-- 执行顺序：先跑这份，再跑 scripts/phase2-schema.sql + scripts/phase2-rls.sql（第二阶段业务表），
-- 最后跑 scripts/phase3-evidence-migration.sql（本文件已包含它的最终结果，通常不需要再单独跑）。
-- 执行后按 README「数据库初始化（新环境/换项目必读）」做一次 anon 只读探测。
--
-- 说明：本文件的列定义是从现有正式 Supabase 项目（rapuvaalzlrsjodjwqtw）用
-- list_tables 内省导出的真实结构，不是从代码反推的猜测；新建环境跑完这份应该和正式项目结构一致。

-- ============================================================
-- 1) raw_emails：原始层（邮件原样数据，只读不改，由导入脚本写入）
-- ============================================================
create table if not exists public.raw_emails (
  email_id text primary key,
  from_address text,
  subject text not null default '',
  body text not null default '',
  normalized_body text not null default '',
  attachment_paths text[] not null default '{}',
  imported_at timestamptz not null default now(),
  content_hash text
);

comment on table public.raw_emails is '原始层：邮件原样数据（sender/subject/body/附件清单），由 scripts/import-sample-data.mjs 导入，只读不改';
comment on column public.raw_emails.content_hash is '邮件原样内容的指纹（sha256）：增量导入时内容没变就跳过';

-- ============================================================
-- 2) parsed_attachments：文字层（附件解析出的文字 + 扁平化文本）
-- ============================================================
create table if not exists public.parsed_attachments (
  email_id text not null references public.raw_emails (email_id),
  file_path text not null,
  file_format text check (file_format = any (array['txt', 'pdf', 'xlsx', 'docx', 'unsupported'])),
  parse_status text check (parse_status = any (array['ok', 'unreadable'])),
  parse_error text,
  parsed_text text not null default '',
  normalized_text text not null default '',
  updated_at timestamptz not null default now(),
  content_hash text,
  primary key (email_id, file_path)
);

comment on table public.parsed_attachments is '文字层：附件解析出的文字与扁平化文本；扫描件/损坏文件 parse_status=unreadable（以后接 OCR 重跑导入补上）';
comment on column public.parsed_attachments.content_hash is '解析结果（状态+文字）的指纹：增量导入时没变就跳过';

-- ============================================================
-- 3) verification_results：结果层（分类/抽取/比对结果，按 email_id upsert 写入）
-- ============================================================
create table if not exists public.verification_results (
  email_id text primary key references public.raw_emails (email_id),
  category text check (
    category = any (array['BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'])
  ),
  comparison_status text check (comparison_status = any (array['OK', 'MISMATCH', 'NEEDS_REVIEW'])),
  review_reason text check (
    review_reason = any (array['wrong_doc_type', 'missing_attachment', 'unreadable', 'missing_value'])
  ),
  defect_fields jsonb not null default '[]'::jsonb,
  has_defect boolean,
  extracted_si jsonb,
  extracted_bl jsonb,
  model_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  input_hash text,
  logic_version text,
  processing_status text not null default 'ok' check (processing_status = any (array['ok', 'failed'])),
  error_message text,
  defect_count integer generated always as (jsonb_array_length(defect_fields)) stored,
  evidence_si jsonb,
  evidence_bl jsonb
);

comment on table public.verification_results is '结果层：分类/抽取/比对结果（按 email_id upsert 写入）';
comment on column public.verification_results.input_hash is '产出该结果时的输入指纹（邮件+附件文本）：没变就跳过重算';
comment on column public.verification_results.logic_version is '引擎版本号：规则/提示词改动时手动 +1，用于让旧结果/旧缓存失效';
comment on column public.verification_results.processing_status is '流水线处理状态：ok=正常产出结果；failed=处理失败（原因见 error_message）';
comment on column public.verification_results.error_message is '处理失败时的可读错误信息，成功时为 null';
comment on column public.verification_results.defect_count is 'defect_fields 的数量（生成列，数据库自动维护），用于排序和统计';

-- ============================================================
-- 4) llm_call_cache：模型调用缓存（仅服务端 service role 可读写，无 anon 策略）
-- ============================================================
create table if not exists public.llm_call_cache (
  cache_key text primary key,
  purpose text not null,
  provider text not null,
  model text,
  request_payload jsonb not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

comment on table public.llm_call_cache is '模型调用缓存：键=实际发送内容的指纹+模型+用途+版本；仅服务端（service role）可读写';
comment on column public.llm_call_cache.cache_key is 'sha256(用途|版本|provider|model|实际发送内容)';
comment on column public.llm_call_cache.request_payload is '当次实际发送给模型的内容（含截断后的版本），用于核对缓存对应哪次输入';
comment on column public.llm_call_cache.response_payload is '模型返回的完整结果（不存截断版）';

-- ============================================================
-- 5) verification_overview：只读视图（results 模块查询用；含 phase3 的 evidence 两列）
-- ============================================================
create or replace view public.verification_overview
with (security_invoker = true) as
select
  e.email_id,
  e.from_address,
  e.subject,
  e.attachment_paths,
  r.category,
  r.comparison_status,
  r.review_reason,
  r.defect_fields,
  r.defect_count,
  r.has_defect,
  coalesce(r.processing_status, 'pending'::text) as processing_status,
  r.email_id is not null as processed,
  r.error_message,
  r.model_provider,
  r.logic_version,
  r.updated_at,
  r.extracted_si,
  r.extracted_bl,
  r.evidence_si,
  r.evidence_bl
from public.raw_emails e
left join public.verification_results r on r.email_id = e.email_id;

-- ============================================================
-- 6) RLS：三张业务表开放 anon 只读；llm_call_cache 不给 anon 任何策略（服务端专用）
-- ============================================================
alter table public.raw_emails enable row level security;
alter table public.parsed_attachments enable row level security;
alter table public.verification_results enable row level security;
alter table public.llm_call_cache enable row level security;

drop policy if exists "public read raw_emails" on public.raw_emails;
create policy "public read raw_emails"
  on public.raw_emails for select to anon using (true);

drop policy if exists "public read parsed_attachments" on public.parsed_attachments;
create policy "public read parsed_attachments"
  on public.parsed_attachments for select to anon using (true);

drop policy if exists "public read verification_results" on public.verification_results;
create policy "public read verification_results"
  on public.verification_results for select to anon using (true);

-- llm_call_cache 故意不建 anon 策略：RLS 已启用且没有任何策略 = 默认拒绝所有非 service role 访问，
-- 写入/读取都走 service role key（绕过 RLS），这是 results 模块 stats/list/conflicts/export 之外
-- 唯一不需要 anon 可读的表。
