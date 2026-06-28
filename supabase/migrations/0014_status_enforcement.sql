-- 0014_status_enforcement.sql — a suspended/pending student must not take or submit.
-- Defense-in-depth: an is_active() helper AND-ed into the student read path, plus
-- a status re-check in getTakePayload/submitAssessment (app layer).

create or replace function public.is_active() returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- Re-gate the take path: the ENROLLED-student branch now also requires is_active().
-- The instructor/admin branches are unchanged.
drop policy if exists assignments_select on assignments;
create policy assignments_select on assignments for select
  using (
    instructor_id = auth.uid()
    or is_admin()
    or (is_enrolled_class(class_id) and public.is_active())
  );

drop policy if exists assessments_select on assessments;
create policy assessments_select on assessments for select
  using (
    instructor_id = auth.uid()
    or is_admin()
    or (student_sees_assessment(id) and public.is_active())
  );
