-- 0011_quiz_timer.sql — optional per-attempt time limit for timed assessments.
-- A default lives on the assessment; an assignment can override it per section.
-- quiz_attempts records when a student first opened a timed assignment so the
-- countdown keeps running across refreshes/devices (deadline = started_at + duration).

alter table assessments add column default_duration_minutes int;
alter table assignments  add column duration_minutes int;

create table quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id    uuid not null references profiles(id)    on delete cascade,
  started_at    timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- Service-role only (all access via server actions); no public policies,
-- mirroring assessment_keys. RLS on with zero policies = deny to anon/authenticated.
alter table quiz_attempts enable row level security;
grant select, insert, update, delete on public.quiz_attempts to service_role;
