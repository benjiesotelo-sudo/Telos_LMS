-- 0017_attempt_draft_answers.sql — server-side draft answers for cross-device resume.
-- Reuses quiz_attempts (one row per student+assignment) to hold in-progress answers,
-- so a student who starts on one device can resume on another. Service-role only
-- (saved via the saveDraft/getDraft server actions, which enrollment-guard the caller).

alter table quiz_attempts add column answers jsonb not null default '{}'::jsonb;
