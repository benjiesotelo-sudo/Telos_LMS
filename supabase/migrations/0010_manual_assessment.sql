-- 0010_manual_assessment.sql — mark an assessment as manual (offline, record-only; not takeable).
alter table assessments add column is_manual boolean not null default false;
