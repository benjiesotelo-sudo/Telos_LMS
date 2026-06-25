-- seed.sql — Telos_LMS Slice 1 pilot seed.
--
-- INSTRUCTOR BOOTSTRAP (out-of-band, NOT done here):
--   The instructor auth user is created OUTSIDE this file.
--     - Cloud (dprrunxkmsavqmbuzkwf): Benjamin creates an auth user in the
--       Supabase dashboard (Authentication -> Users -> Add user) with email
--       benjiesotelo@gmail.com, copies its uuid. The 0001 trigger auto-creates
--       a profiles row. If the dashboard user is created without metadata,
--       Benjamin sets that profile to role='instructor', status='active'.
--     - Local (vitest): the createUser fixture provisions users; a fresh local
--       stack has NO instructor user, so the inserts below NO-OP (see guards).
--   seed.sql NEVER inserts into auth.users and NEVER hardcodes a UUID. It looks
--   the instructor up by email and is fully idempotent. NO test users belong here
--   (integration suites self-provision via tests/helpers/fixtures.ts).

-- Ensure the bootstrapped instructor's profile is role=instructor/status=active.
-- NO-OP when the auth user is absent (fresh local stack).
update public.profiles p
   set role = 'instructor', status = 'active'
  from auth.users u
 where u.email = 'benjiesotelo@gmail.com'
   and p.id = u.id;

-- Pilot course (AMS0011), owned by the bootstrapped instructor. Idempotent.
insert into public.courses (instructor_id, code, title)
select u.id, 'AMS0011', 'Algebra & Trigonometry'
  from auth.users u
 where u.email = 'benjiesotelo@gmail.com'
   and not exists (
     select 1 from public.courses c
      where c.instructor_id = u.id and c.code = 'AMS0011'
   );

-- Pilot period (Midyear) on the pilot course. Idempotent.
insert into public.periods (course_id, instructor_id, label)
select c.id, c.instructor_id, 'Midyear'
  from public.courses c
  join auth.users u on u.id = c.instructor_id
 where u.email = 'benjiesotelo@gmail.com'
   and c.code = 'AMS0011'
   and not exists (
     select 1 from public.periods pr
      where pr.course_id = c.id and pr.label = 'Midyear'
   );
