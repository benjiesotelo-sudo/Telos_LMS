-- 0013_removal_requests.sql — instructor-requested student removals, admin-approved.
-- An instructor can't remove a student directly; they file a reason-gated request
-- that an admin approves (deletes the enrollment) or rejects.

create table enrollment_removal_requests (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references classes(id)  on delete cascade,
  student_id   uuid not null references profiles(id) on delete cascade,
  requested_by uuid references profiles(id)          on delete set null,
  reason       text not null,
  status       text not null default 'pending',  -- pending | approved | rejected
  reviewed_by  uuid references profiles(id)           on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Only one OPEN (pending) request per (class, student).
create unique index enrollment_removal_pending_uniq
  on enrollment_removal_requests (class_id, student_id)
  where status = 'pending';

-- Service-role only (all access via guarded server actions).
alter table enrollment_removal_requests enable row level security;
grant select, insert, update, delete on public.enrollment_removal_requests to service_role;
