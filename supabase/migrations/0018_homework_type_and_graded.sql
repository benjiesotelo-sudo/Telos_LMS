-- 0018_homework_type_and_graded.sql
-- (1) New assessment TYPE tag 'homework' — graded in the same Papers/HW weight bucket
--     as 'activity' (NOT a new weight category). Quiz and exam unchanged.
-- (2) Per-assessment is_graded flag (default true). For homework/activity the instructor
--     can mark it ungraded (practice): it still shows a score for feedback but is excluded
--     from MG/FG/course marks. Quiz/exam are always graded (enforced in the app layer).

alter type assessment_type add value if not exists 'homework';

alter table assessments add column is_graded boolean not null default true;
