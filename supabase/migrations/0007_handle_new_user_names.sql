-- 0007_handle_new_user_names.sql — extend handle_new_user to copy structured name parts.
-- Replaces the function from 0001; trigger binding is unchanged.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (
    id, email, full_name, role, status, student_number,
    prefix, first_name, middle_initial, last_name, suffix
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student'),
    coalesce((new.raw_user_meta_data->>'status')::user_status, 'active'),
    nullif(new.raw_user_meta_data->>'student_number', ''),
    coalesce(new.raw_user_meta_data->>'prefix', ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'middle_initial', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'suffix', '')
  )
  on conflict (id) do nothing;
  return new;
end
$fn$;
