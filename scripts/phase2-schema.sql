-- 第二阶段表结构（PHASE2_SPEC.md 第 3.1 / 4.1 / 5.1 节）
-- 用法：Supabase 控制台 → SQL Editor → 全部粘贴执行（可重复执行，幂等）
-- 执行后跑一次：node scripts/setup-phase2.mjs

-- 1) 配置中心：GUI 可调的运行时配置（敏感值加密后存这里）
create table if not exists app_config (
  key text primary key,
  category text not null default 'general',
  value jsonb,
  is_secret boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2) 邮件账户（Gmail 等，本阶段只做连接状态占位）
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

-- 3) 可切换的 Supabase 项目（service_key 加密存储）
create table if not exists supabase_projects (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  project_url text not null,
  anon_key text,
  service_key text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 同一时间最多一个项目处于启用状态
create unique index if not exists supabase_projects_single_active
  on supabase_projects ((is_active)) where is_active;

-- 4) 手动上传的文档（原文件在 Storage bucket `uploads`，这里存元数据+解析文本）
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
