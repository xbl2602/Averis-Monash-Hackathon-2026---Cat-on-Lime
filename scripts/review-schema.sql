-- The two tables for the manual review loop (P1-1, see docs/REVIEW_SPEC.md §3)
-- Usage: Supabase console -> SQL Editor -> paste all and run (idempotent, safe to re-run).
-- Reads are open to anon (the review queue/history are visible anonymously); writes are service-role only (REST/MCP go through the service client).

-- ============================================================
-- 1) review_overrides: the currently effective human conclusion, one row per (target_kind, email_id)
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

comment on table public.review_overrides is 'Manual review loop: the currently effective human conclusion (one row per target_kind+email_id, written via upsert, updated_at used as an optimistic lock)';

-- ============================================================
-- 2) review_actions: append-only audit log
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

comment on table public.review_actions is 'Manual review loop: an append-only action audit log (an undo is also just an appended undo row)';

create index if not exists review_actions_target_idx
  on public.review_actions (target_kind, email_id, created_at desc);

-- ============================================================
-- 3) RLS: reads open to anon; writes go through service role only (no anon insert/update policies are created)
-- ============================================================
alter table public.review_overrides enable row level security;
alter table public.review_actions enable row level security;

drop policy if exists "public read review_overrides" on public.review_overrides;
create policy "public read review_overrides"
  on public.review_overrides for select to anon using (true);

drop policy if exists "public read review_actions" on public.review_actions;
create policy "public read review_actions"
  on public.review_actions for select to anon using (true);
