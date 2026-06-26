-- 0004_pending_cleanup.sql — sweep stale pending accounts.
-- We do not record which link a student used, so we purge by age: any account
-- still 'pending' after the longest link life (class-join = 7 days) is stale —
-- a valid registrant is approved well within that window, and a 7-day link can
-- legitimately keep someone pending up to ~7 days, so 7 days is the safe floor.
create function public.purge_expired_pending() returns integer
  language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with victims as (
    select p.id from profiles p
    where p.status = 'pending'
      and p.created_at < now() - interval '7 days'
  )
  delete from auth.users u using victims v where u.id = v.id;
  get diagnostics n = row_count;
  return n;
end $$;
