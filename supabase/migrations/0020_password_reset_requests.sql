-- 0020_password_reset_requests.sql — student-initiated, instructor-approved password resets.
--
-- A locked-out student (wrong/forgotten password) requests a reset from the login page:
-- they choose a NEW password, which is held here until an admin approves. On approval the
-- chosen password is applied to their auth account and their account is re-activated; the
-- stored secret is cleared. Email-free recovery — the built-in email reset is unreliable in
-- a live classroom (rate limits, no SMTP, students without inbox access mid-class).
--
-- Mirrors the enrollment_removal_requests pattern: service-role only, all access via guarded
-- server actions. The chosen password is held in `new_password` exactly like assessment_keys
-- holds answer keys — RLS ON with ZERO policies, so ONLY the service role (the guarded actions)
-- can ever read it; it is NULLed the moment the request is resolved.

create table password_reset_requests (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  -- The student's chosen new password, held until an admin approves; NULLed on resolve.
  new_password text,
  status       text not null default 'pending',  -- pending | approved | rejected
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- At most one OPEN (pending) request per profile.
create unique index password_reset_pending_uniq
  on password_reset_requests (profile_id)
  where status = 'pending';

-- Service-role only (all access via guarded server actions). No anon/authenticated policies.
alter table password_reset_requests enable row level security;
grant select, insert, update, delete on public.password_reset_requests to service_role;
