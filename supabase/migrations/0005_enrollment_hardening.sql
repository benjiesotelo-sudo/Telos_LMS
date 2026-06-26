-- 0005_enrollment_hardening.sql — close student self-enroll hole + lock down purge.
drop policy if exists enrollments_all on enrollments;
create policy enrollments_select on enrollments for select
  using (student_id = auth.uid() or is_admin() or instructs_student(student_id));
create policy enrollments_modify on enrollments for all
  using (is_admin() or instructs_student(student_id))
  with check (is_admin() or instructs_student(student_id));
revoke execute on function public.purge_expired_pending() from anon, authenticated;
