-- phase3：字段级出处落库（2026-09-21，P1-7，见 DECISION_LOG 决策 29）
-- 已应用到 Supabase 项目 rapuvaalzlrsjodjwqtw（migration: add_evidence_columns_to_verification_results）。
-- 作用：verification_results 增加两个 JSONB 列，存规则解析命中的行号+原句（LLM 兜底只标来源）；
--       视图 verification_overview 同步追加这两列（security_invoker 选项保持不变）。
-- 说明：本仓库的 DDL 以控制台/迁移工具为准，本文件用于留档，方便以后重建环境时对齐。

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
