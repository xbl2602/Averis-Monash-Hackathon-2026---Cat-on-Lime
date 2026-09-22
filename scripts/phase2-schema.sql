-- Phase-2 table structure (PHASE2_SPEC.md sections 3.1 / 4.1 / 5.1)
-- Usage: Supabase console -> SQL Editor -> paste all and run (safe to re-run, idempotent)
-- After running, execute once: node scripts/setup-phase2.mjs

-- 1) Config center: runtime config adjustable via the GUI (sensitive values are encrypted before being stored here)
create table if not exists app_config (
  key text primary key,
  category text not null default 'general',
  value jsonb,
  is_secret boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2) Mail accounts (Gmail etc.; this phase only stubs out the connection status)
create table if not exists mail_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  email_address text,
  status text not null default 'disconnected',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

-- 3) Switchable Supabase projects (service_key is stored encrypted)
create table if not exists supabase_projects (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  project_url text not null,
  anon_key text,
  service_key text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- At most one project is active at any given time
create unique index if not exists supabase_projects_single_active
  on supabase_projects ((is_active)) where is_active;

-- 4) Manually uploaded documents (the original file lives in the Storage bucket `uploads`; this stores metadata + parsed text)
create table if not exists uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_size bigint not null,
  mime text,
  storage_path text,
  file_hash text not null unique,
  parse_status text not null default 'ok',
  parse_error text,
  extracted_text text,
  detected_type text not null default 'UNKNOWN',
  review_status text not null default 'pending',
  uploaded_by text not null default 'admin',
  updated_at timestamptz not null default now()
);

create index if not exists uploaded_documents_review_idx
  on uploaded_documents (review_status, detected_type);
