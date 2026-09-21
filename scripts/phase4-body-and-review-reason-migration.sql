-- phase4：邮件正文进视图 + 新增 review_reason（2026-09-22，裁判/队友试用后报的 GUI+后端联合 bug）
-- 已应用到 Supabase 项目 rapuvaalzlrsjodjwqtw。
-- 说明：本仓库的 DDL 以控制台/迁移工具为准，本文件用于留档，方便以后重建环境时对齐。
--
-- 1) 复核详情页之前完全不显示邮件正文，人没法凭内容判断该怎么处理（只能看到抽取出的字段）。
--    raw_emails 本来就有 body 列，只是视图没选出来——补上。
--    body 放在 select 列表最后：CREATE OR REPLACE VIEW 不允许改已有列的名字/顺序，
--    只能在末尾追加新列（实测踩过一次 "cannot change name of view column" 才发现）。
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
  r.evidence_bl,
  e.body
from public.raw_emails e
left join public.verification_results r on r.email_id = e.email_id;

-- 2) 新增 review_reason 取值 low_confidence_classification：Jev 分类给了结果但置信度 < 0.85
--    这个信号一直算得出来，但从没有落库过，复核队列里"系统无法判断邮件类型"完全没有入口
--    （只覆盖了"全部模型失败"那一种情况）。见 lib/shared/pipeline.ts 的 applyClassificationConfidence。
alter table public.verification_results drop constraint if exists email_results_review_reason_check;
alter table public.verification_results add constraint email_results_review_reason_check
  check (review_reason = any (array['wrong_doc_type', 'missing_attachment', 'unreadable', 'missing_value', 'low_confidence_classification']));

-- 注意：这两处改动都只影响"之后新产生的数据"。已经跑过的 3288 行不会自动补上 body 缺失以外的东西
-- （body 是 select 出来的已有数据，立即生效），但已存的 review_reason 不会被这次迁移改写，
-- 低置信度分类的旧结果要重新跑一遍流水线（Full pipeline，勾选"Recalculate everything"）才会补上标记。
