-- 人工复核闭环的两张表（P1-1，见 docs/REVIEW_SPEC.md §3）
-- 用法：Supabase 控制台 → SQL Editor → 全部粘贴执行（幂等，可重复执行）。
-- 读对 anon 开放（复核队列/历史匿名可看），写只有 service role（REST/MCP 走 service client）。

-- ============================================================
-- 1) review_overrides：当前生效的人工结论，每个 (target_kind, email_id) 一行
-- ============================================================
create table if not exists public.review_overrides (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (
    target_kind = any (array['classification', 'extraction', 'comparison', 'pipeline'])
  ),
  email_id text not null,
  review_state text not null check (review_state = any (array['confirmed', 'corrected', 'deferred'])),
  disposition text check (
    disposition = any (
      array['accepted', 'corrected', 'routed', 'returned', 'awaiting_input', 'unprocessable']
    )
  ),
  category text,
  comparison_status text,
  review_reason text,
  defect_fields jsonb,
  extracted_si jsonb,
  extracted_bl jsonb,
  note text,
  decided_by text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target_kind, email_id)
);

comment on table public.review_overrides is '人工复核闭环：当前生效的人工结论（每个 target_kind+email_id 一行，upsert 写入，updated_at 做乐观锁）';

-- ============================================================
-- 2) review_actions：append-only 审计日志
-- ============================================================
create table if not exists public.review_actions (
  id bigint generated always as identity primary key,
  target_kind text not null,
  email_id text not null,
  action_type text not null check (
    action_type = any (
      array['confirm', 'correct', 'disposition', 'defer', 'undefer', 'note', 'rerun', 'undo']
    )
  ),
  before_state jsonb,
  after_state jsonb,
  undo_of bigint references public.review_actions (id),
  reason text,
  note text,
  actor text not null default 'admin',
  batch_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.review_actions is '人工复核闭环：只增不改的动作审计日志（撤销也是追加一条 undo 行）';

create index if not exists review_actions_target_idx
  on public.review_actions (target_kind, email_id, created_at desc);

-- ============================================================
-- 3) RLS：读开放给 anon，写只走 service role（不建 anon 的 insert/update 策略）
-- ============================================================
alter table public.review_overrides enable row level security;
alter table public.review_actions enable row level security;

drop policy if exists "public read review_overrides" on public.review_overrides;
create policy "public read review_overrides"
  on public.review_overrides for select to anon using (true);

drop policy if exists "public read review_actions" on public.review_actions;
create policy "public read review_actions"
  on public.review_actions for select to anon using (true);
