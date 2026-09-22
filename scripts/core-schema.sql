-- The three core tables + read-only view + model-call cache table (P0-1, 2026-09-21)
-- Usage: Supabase console -> SQL Editor -> paste all and run (idempotent, safe to re-run).
-- Run order: run this one first, then scripts/phase2-schema.sql + scripts/phase2-rls.sql (phase-2 business tables),
-- and finally scripts/phase3-evidence-migration.sql (this file already includes its final result, so you usually don't need to run it separately).
-- After running, do an anon read-only probe as described in the README's "Database initialization (must-read for a new environment/project)".
--
-- Note: the column definitions in this file are the real structure exported via list_tables introspection
-- from the existing production Supabase project (rapuvaalzlrsjodjwqtw) — not a guess reverse-engineered from code; a new environment should match the production structure after running this.

-- ============================================================
-- 1) raw_emails: raw layer (emails verbatim, read-only, written by the import script)
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

comment on table public.raw_emails is 'Raw layer: emails verbatim (sender/subject/body/attachment list), imported by scripts/import-sample-data.mjs, read-only';
comment on column public.raw_emails.content_hash is 'Fingerprint (sha256) of the raw email content: skipped during incremental import if content is unchanged';

-- ============================================================
-- 2) parsed_attachments: text layer (text parsed from attachments + flattened text)
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

comment on table public.parsed_attachments is 'Text layer: text parsed from attachments and flattened text; scanned/corrupted files get parse_status=unreadable (to be backfilled later by re-running import with OCR)';
comment on column public.parsed_attachments.content_hash is 'Fingerprint of the parse result (status + text): skipped during incremental import if unchanged';

-- ============================================================
-- 3) verification_results: results layer (classification/extraction/comparison results, written via upsert keyed on email_id)
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

comment on table public.verification_results is 'Results layer: classification/extraction/comparison results (written via upsert keyed on email_id)';
comment on column public.verification_results.input_hash is 'Fingerprint of the input (email + attachment text) at the time this result was produced: skip recomputation if unchanged';
comment on column public.verification_results.logic_version is 'Engine version number: manually incremented when rules/prompts change, used to invalidate old results/old cache entries';
comment on column public.verification_results.processing_status is 'Pipeline processing status: ok = result produced normally; failed = processing failed (see error_message for the reason)';
comment on column public.verification_results.error_message is 'Human-readable error message when processing fails; null on success';
comment on column public.verification_results.defect_count is 'Count of defect_fields (a generated column maintained automatically by the database), used for sorting and stats';

-- ============================================================
-- 4) llm_call_cache: model-call cache (readable/writable only by the server-side service role, no anon policy)
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

comment on table public.llm_call_cache is 'Model-call cache: key = fingerprint of the actual sent content + model + purpose + version; readable/writable only server-side (service role)';
comment on column public.llm_call_cache.cache_key is 'sha256(purpose|version|provider|model|actual sent content)';
comment on column public.llm_call_cache.request_payload is 'The content actually sent to the model for this call (including the truncated version), used to verify which input the cache entry corresponds to';
comment on column public.llm_call_cache.response_payload is 'The full result returned by the model (the truncated version is not stored)';

-- ============================================================
-- 5) verification_overview: read-only view (used by the results module's queries; includes the two phase-3 evidence columns)
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
-- 6) RLS: the three business tables allow anon read-only; llm_call_cache has no anon policy at all (server-only)
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

-- llm_call_cache intentionally has no anon policy: RLS is enabled with no policies at all = deny by default for any
-- non-service-role access; both writes and reads go through the service role key (bypassing RLS). This is the
-- only table outside the results module's stats/list/conflicts/export that doesn't need to be anon-readable.
