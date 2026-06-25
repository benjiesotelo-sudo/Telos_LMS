-- 0002_rls.sql — default-deny RLS + SECURITY DEFINER helpers (Slice 1)

-- Enable RLS on every table (default deny until a policy permits).
alter table profiles        enable row level security;
alter table courses         enable row level security;
alter table periods         enable row level security;
alter table enrollments     enable row level security;
alter table assessments     enable row level security;
alter table assessment_keys enable row level security;
alter table assignments     enable row level security;
alter table submissions     enable row level security;
alter table invites         enable row level security;

-- SECURITY DEFINER helpers: evaluate membership without recursing through RLS.
create function public.is_admin() returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create function public.instructs_student(p_student uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from enrollments e
    join courses c on c.id = e.course_id
    where e.student_id = p_student and c.instructor_id = auth.uid()
  )
$$;

create function public.is_enrolled_course(p_course uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from enrollments
    where student_id = auth.uid() and course_id = p_course
  )
$$;

create function public.is_enrolled(p_course uuid, p_period uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from enrollments
    where student_id = auth.uid() and course_id = p_course and period_id = p_period
  )
$$;

create function public.student_sees_assessment(p_assessment uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from assignments a
    join enrollments e on e.course_id = a.course_id and e.period_id = a.period_id
    where a.assessment_id = p_assessment and e.student_id = auth.uid()
  )
$$;

-- profiles
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_admin() or instructs_student(id));
create policy profiles_write on profiles for all
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- courses
create policy courses_select on courses for select
  using (instructor_id = auth.uid() or is_admin() or is_enrolled_course(id));
create policy courses_write on courses for all
  using (instructor_id = auth.uid() or is_admin())
  with check (instructor_id = auth.uid() or is_admin());

-- periods
create policy periods_select on periods for select
  using (instructor_id = auth.uid() or is_admin() or is_enrolled(course_id, id));
create policy periods_write on periods for all
  using (instructor_id = auth.uid() or is_admin())
  with check (instructor_id = auth.uid() or is_admin());

-- enrollments
create policy enrollments_all on enrollments for all
  using (student_id = auth.uid() or is_admin() or instructs_student(student_id))
  with check (student_id = auth.uid() or is_admin() or instructs_student(student_id));

-- assessments (students read questions column; answers live in assessment_keys)
create policy assessments_select on assessments for select
  using (instructor_id = auth.uid() or is_admin() or student_sees_assessment(id));
create policy assessments_write on assessments for all
  using (instructor_id = auth.uid() or is_admin())
  with check (instructor_id = auth.uid() or is_admin());

-- assignments
create policy assignments_select on assignments for select
  using (instructor_id = auth.uid() or is_admin() or is_enrolled(course_id, period_id));
create policy assignments_write on assignments for all
  using (instructor_id = auth.uid() or is_admin())
  with check (instructor_id = auth.uid() or is_admin());

-- submissions: read-only for the student + the owning instructor + admin.
-- NO authenticated INSERT/UPDATE/DELETE policy — every write goes through
-- submitAssessment via createAdminClient (service-role).
create policy submissions_select on submissions for select
  using (student_id = auth.uid() or instructor_id = auth.uid() or is_admin());

-- assessment_keys + invites: RLS enabled, ZERO permissive policies.
-- Only the service-role (createAdminClient) can read/write them.

-- Privilege-escalation guard: profiles_write lets a user UPDATE their own row
-- (id = auth.uid()), and Task 2's GRANT gives authenticated a TABLE-LEVEL UPDATE.
-- Without this, a student could run UPDATE profiles SET role='admin' on their own
-- row, then is_admin() returns true and they bypass RLS on every table.
--
-- A column-level `revoke update (role, status)` is NOT enough: the table-level
-- UPDATE grant implicitly covers every column, so the revoke is a no-op while it
-- stands. We must remove the table-level UPDATE entirely, then re-grant UPDATE on
-- ONLY the self-service columns. This makes role/status/email/id non-updatable by
-- anon/authenticated while keeping the legit profile-rename path working.
-- service_role keeps its own grant and bypasses RLS; the SECURITY DEFINER
-- handle_new_user trigger runs as table owner, so fixtures/acceptInvite/admin
-- flows are unaffected.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, student_number) on public.profiles to authenticated;
