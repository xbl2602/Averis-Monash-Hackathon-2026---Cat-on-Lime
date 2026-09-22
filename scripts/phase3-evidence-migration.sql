-- Phase 3: persist field-level evidence/provenance (2026-09-21, P1-7, see DECISION_LOG decision 29)
-- Already applied to Supabase project rapuvaalzlrsjodjwqtw (migration: add_evidence_columns_to_verification_results).
-- Purpose: add two JSONB columns to verification_results to store the line numbers + original sentences matched by rule-based parsing (LLM fallback only tags the source);
--       the verification_overview view is updated in lockstep with these two columns (the security_invoker option is unchanged).
-- Note: the console/migration tool is the source of truth for this repo's DDL; this file is kept for reference, to make it easier to align when rebuilding the environment later.

alter table public.verification_results
  add column if not exists evidence_si jsonb,
  add column if not exists evidence_bl jsonb;

create or replace view public.verification_overview as
 SELECT e.email_id,
    e.from_address,
    e.subject,
    e.attachment_paths,
    r.category,
    r.comparison_status,
    r.review_reason,
    r.defect_fields,
    r.defect_count,
    r.has_defect,
    COALESCE(r.processing_status, 'pending'::text) AS processing_status,
    r.email_id IS NOT NULL AS processed,
    r.error_message,
    r.model_provider,
    r.logic_version,
    r.updated_at,
    r.extracted_si,
    r.extracted_bl,
    r.evidence_si,
    r.evidence_bl
   FROM raw_emails e
     LEFT JOIN verification_results r ON r.email_id = e.email_id;
