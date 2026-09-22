-- RLS for the four phase-2 tables (PHASE2_SPEC section 1; 2026-09-20 security review B4)
-- Usage: Supabase console -> SQL Editor -> paste all and run; safe to re-run (from the second run on, output is just NOTICEs).
-- After running, do an anon read-only probe as described in the README's "Database initialization (must-read for a new environment/project)".
--
-- Scope notes:
-- - This script only handles the four phase-2 tables (app_config / mail_accounts / supabase_projects / uploaded_documents).
-- - The DDL and RLS for the three main tables (raw_emails / parsed_attachments / verification_results), the read-only
--   view verification_overview, and the cache table llm_call_cache are not in this repo — they need to be exported
--   from the existing Supabase console and added to scripts/. Note that **verification_results / verification_overview
--   must keep their anon select policy**, otherwise results' list/stats/conflicts/export and pipeline's incremental
--   reads will all fail.
-- - The policy name is fixed as uploaded_documents_anon_select; if an anon policy with a different name was
--   manually created in the console, this script will not replace it (stacking permissive policies is not
--   dangerous, but treat the console's actual policies as the source of truth).
-- - `alter table if exists` outputs a NOTICE and skips tables that don't exist; the do block below guards with
--   to_regclass to avoid a hard error from running a policy statement against a nonexistent table.

alter table if exists public.app_config enable row level security;
alter table if exists public.mail_accounts enable row level security;
alter table if exists public.supabase_projects enable row level security;
alter table if exists public.uploaded_documents enable row level security;

-- uploaded_documents: the code uses the anon key to read the list/detail views (see import/logic/document-store.ts),
-- so it gets a single select policy; the other three tables get no anon policy (API reads go through the service
-- role, bypassing RLS; anon is always rejected via PostgREST).
do $$
begin
  if to_regclass('public.uploaded_documents') is not null then
    drop policy if exists "uploaded_documents_anon_select" on public.uploaded_documents;
    create policy "uploaded_documents_anon_select"
      on public.uploaded_documents for select to anon using (true);
  end if;
end $$;
