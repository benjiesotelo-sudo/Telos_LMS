# Supabase Ops — paste-ready SQL & dashboard steps

One-time operational chores for the **cloud** project `dprrunxkmsavqmbuzkwf` (Telos_LMS).
Run SQL in **Supabase Dashboard → SQL Editor** unless noted. (Never touch `SOTELO_GradeBook` /
`lvcdlulyvwbjrwvkmfwt`.)

> Legend: 🟢 safe/idempotent · ⚠️ check first · 👤 dashboard toggle

---

## §1 · Unique index on `profiles.student_number` (migration 0021)

Stops two students sharing a student number. Shipped as migration `0021_student_number_unique.sql`.

**Pre-flight (run FIRST — finds any existing duplicates that would block the index):** ⚠️
```sql
select student_number, count(*) as n
from public.profiles
where student_number is not null and student_number <> ''
group by student_number
having count(*) > 1
order by n desc;
```
- **0 rows →** safe to apply. From the repo: `supabase db push --linked --yes` (applies 0021 to cloud).
- **Any rows →** resolve the duplicates first (fix/clear the wrong one in **Admin Controls → Users**, or via SQL), then push.

_The index is `where student_number is not null and student_number <> ''`, so blank numbers (instructors/admins) are exempt._

---

## §2 · Schedule `purge_expired_pending()` via pg_cron 🟢

Auto-deletes pending registrations older than 7 days (the function already exists, migration 0004;
it's `revoke`d from anon/authenticated — service-role / SQL-editor only).

```sql
-- Enable pg_cron once (or: Dashboard → Database → Extensions → enable "pg_cron").
create extension if not exists pg_cron;

-- Daily at 03:00 UTC.
select cron.schedule(
  'purge-expired-pending',
  '0 3 * * *',
  $$ select public.purge_expired_pending(); $$
);
```
Inspect / change later:
```sql
select jobid, schedule, jobname, active from cron.job;            -- list jobs
-- select cron.unschedule('purge-expired-pending');               -- remove
-- select * from cron.job_run_details order by start_time desc limit 10;  -- run history
```

---

## §3 · Lock down public signups 👤

The signup trigger (`handle_new_user`, 0007) trusts a `role` in signup metadata if present
(defaulting to `student`). That only matters if **public** signup is open, so just keep it closed:

- **Dashboard → Authentication → Sign In / Providers → Email →** turn **"Allow new users to sign up" OFF**.
- This does **NOT** break enrollment-link registration: `registerViaLink` creates the user via the
  **admin API** (service role), which bypasses the public-signup switch. Link sign-ups keep working;
  only anonymous self-signup at the auth endpoint is closed.

_(No code change needed. Re-engineering the trigger to hard-force `role='student'` is avoided on
purpose — it would also block admin-created instructors/admins, which go through the same trigger.)_

---

## §4 · Saved admin SQL snippets

Paste-and-save these in the SQL Editor for quick reuse.

### List Users 🟢
```sql
select full_name, email, role, status, student_number, created_at
from public.profiles
order by created_at desc;
```

### Health Check 🟢
```sql
select
  (select count(*) from public.profiles)                              as users,
  (select count(*) from public.profiles where status = 'pending')     as pending_users,
  (select count(*) from public.profiles where status = 'suspended')   as suspended_users,
  (select count(*) from public.courses)                               as courses,
  (select count(*) from public.classes)                               as classes,
  (select count(*) from public.enrollments where status = 'active')   as active_enrollments,
  (select count(*) from public.assessments)                           as assessments,
  (select count(*) from public.enrollment_removal_requests where status = 'pending') as open_removals,
  (select count(*) from public.password_reset_requests   where status = 'pending')   as open_pw_resets;
```

### Clean Test Data ⚠️ (SCOPED — cannot touch Mamoun / Benjie / AMS0011)
Only run when you're done testing. Deletes the SMOKE fixtures.
```sql
delete from auth.users      where email ilike '%+smoke%';
delete from public.courses  where code = 'SMOKE101';
delete from public.assessments where title ilike 'Homework Smoke%';
```

### 1st Setup — make Benjie super-admin 🟢 (idempotent)
Only needed on a fresh project (seed.sql normally does this). Looks the user up by email.
```sql
update public.profiles p
   set role           = 'admin',
       status         = 'active',
       prefix         = '',
       first_name     = 'Benjamin',
       middle_initial = 'C.',
       last_name      = 'Sotelo',
       suffix         = '',
       student_number = '202601011',
       full_name      = 'Benjamin C. Sotelo'
  from auth.users u
 where u.email = 'benjiesotelo@gmail.com'
   and p.id = u.id;
```

---

### Checklist
- [ ] §1 pre-flight returns 0 rows → `supabase db push` applies 0021
- [ ] §2 pg_cron scheduled (`cron.job` shows `purge-expired-pending`)
- [ ] §3 public signup turned OFF in the dashboard
- [ ] §4 four snippets saved in the SQL Editor
