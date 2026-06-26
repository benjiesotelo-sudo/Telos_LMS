-- 0003_classes_roster.sql — Theme B: reusable courses + classes(sections) + enroll links.

-- 1) Drop policies/helpers that reference soon-to-change columns -------------
-- Drop all policies that reference the four helpers we are replacing.
-- profiles_select uses instructs_student; assessments_select uses student_sees_assessment.
drop policy if exists profiles_select on profiles;
drop policy if exists assessments_select on assessments;
drop policy if exists periods_select on periods;
drop policy if exists periods_write on periods;
drop policy if exists enrollments_all on enrollments;
drop policy if exists assignments_select on assignments;
drop policy if exists courses_select on courses;
drop function if exists public.is_enrolled(uuid, uuid);
drop function if exists public.is_enrolled_course(uuid);
drop function if exists public.instructs_student(uuid);
drop function if exists public.student_sees_assessment(uuid);

-- 2) New enum + columns + tables --------------------------------------------
create type enroll_link_kind as enum ('class','general');

alter table courses add column description text not null default '';

create table classes (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  period text not null check (period in ('1st Semester','2nd Semester','Midyear','Special Course')),
  section_label text not null,
  pic text not null default '',
  created_at timestamptz not null default now(),
  unique (course_id, period, section_label)
);

create table enroll_links (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  instructor_id uuid not null references profiles(id) on delete cascade,
  kind enroll_link_kind not null,
  class_id uuid references classes(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'general' or class_id is not null)
);

-- 3) Backfill the pilot BEFORE repointing FKs --------------------------------
-- One class per existing (course, period) pair, owned by the course instructor.
insert into classes (instructor_id, course_id, period, section_label, pic)
select c.instructor_id, c.id, p.label, '1', ''
from periods p join courses c on c.id = p.course_id;

-- 4) Repoint enrollments to class_id ----------------------------------------
alter table enrollments add column class_id uuid references classes(id) on delete cascade;
update enrollments e set class_id = cl.id
  from classes cl where cl.course_id = e.course_id and cl.period = (
    select label from periods where id = e.period_id);
alter table enrollments alter column class_id set not null;
alter table enrollments drop constraint enrollments_student_id_course_id_period_id_key;
alter table enrollments drop column course_id;
alter table enrollments drop column period_id;
alter table enrollments add constraint enrollments_student_class_key unique (student_id, class_id);

-- 5) Repoint assignments to class_id; drop pic (now on class) ----------------
alter table assignments add column class_id uuid references classes(id) on delete cascade;
update assignments a set class_id = cl.id
  from classes cl where cl.course_id = a.course_id and cl.period = (
    select label from periods where id = a.period_id);
alter table assignments alter column class_id set not null;
alter table assignments drop column pic;
alter table assignments drop column course_id;
alter table assignments drop column period_id;

-- 6) Drop the now-unused tables ---------------------------------------------
-- invites must be dropped before periods (invites_period_id_fkey references periods).
drop table invites;
drop table periods;

-- 7) Rewritten SECURITY DEFINER helpers (class-based) ------------------------
create function public.instructs_student(p_student uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from enrollments e join classes cl on cl.id = e.class_id
    where e.student_id = p_student and cl.instructor_id = auth.uid())
$$;

create function public.is_enrolled_class(p_class uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(select 1 from enrollments
    where student_id = auth.uid() and class_id = p_class)
$$;

create function public.is_enrolled_course(p_course uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(select 1 from enrollments e join classes cl on cl.id = e.class_id
    where e.student_id = auth.uid() and cl.course_id = p_course)
$$;

create function public.student_sees_assessment(p_assessment uuid) returns boolean
  language sql security definer stable set search_path=public as $$
  select exists(
    select 1 from assignments a join enrollments e on e.class_id = a.class_id
    where a.assessment_id = p_assessment and e.student_id = auth.uid())
$$;

-- 8) RLS for new tables + rewritten policies --------------------------------
alter table classes enable row level security;
alter table enroll_links enable row level security;

create policy courses_select on courses for select
  using (instructor_id = auth.uid() or is_admin() or is_enrolled_course(id));

create policy classes_select on classes for select
  using (instructor_id = auth.uid() or is_admin() or is_enrolled_class(id));
create policy classes_write on classes for all
  using (instructor_id = auth.uid() or is_admin())
  with check (instructor_id = auth.uid() or is_admin());

create policy enrollments_all on enrollments for all
  using (student_id = auth.uid() or is_admin() or instructs_student(student_id))
  with check (student_id = auth.uid() or is_admin() or instructs_student(student_id));

create policy assignments_select on assignments for select
  using (instructor_id = auth.uid() or is_admin() or is_enrolled_class(class_id));

create policy enroll_links_write on enroll_links for all
  using (instructor_id = auth.uid() or is_admin())
  with check (instructor_id = auth.uid() or is_admin());
-- enroll_links has NO anon/student read policy: registration reads it via the
-- service-role admin client only (like the retired invites table).

-- Recreate policies dropped in step 1 that reference the rewritten helpers.
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_admin() or instructs_student(id));

create policy assessments_select on assessments for select
  using (instructor_id = auth.uid() or is_admin() or student_sees_assessment(id));

-- 9) Grants for new tables (RLS still restricts) -----------------------------
grant select, insert, update, delete on public.classes, public.enroll_links
  to service_role, anon, authenticated;
