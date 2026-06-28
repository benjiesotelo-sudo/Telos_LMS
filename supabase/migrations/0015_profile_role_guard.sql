-- 0015_profile_role_guard.sql — make the no-self-promote guard regression-proof.
-- Today a column-level grant (full_name, student_number only) blocks role/status
-- self-edits. This trigger is defense-in-depth: even if a future migration re-grants
-- table UPDATE on profiles, a non-admin still cannot change role or status.
--
-- Allowed to change role/status:
--   • service-role / server-side (auth.uid() IS NULL) — admin user-management actions
--   • an admin user (is_admin())
-- Anyone else attempting to change role/status is rejected.

create or replace function public.guard_profile_role_status() returns trigger
  language plpgsql security definer set search_path=public as $$
begin
  if (new.role is distinct from old.role) or (new.status is distinct from old.status) then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'Not allowed to change role or status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_status on public.profiles;
create trigger guard_profile_role_status
  before update on public.profiles
  for each row execute function public.guard_profile_role_status();
