-- 0001_init.sql — Telos_LMS Slice 1 schema (enums + 9 tables + auto-provision trigger).

-- Enums --------------------------------------------------------------------
create type user_role as enum ('admin','instructor','student');
create type user_status as enum ('pending','active','suspended');
create type assessment_type as enum ('activity','quiz','exam');
create type submission_status as enum ('in_progress','submitted','graded');

-- Tables -------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'student',
  status user_status not null default 'active',
  full_name text not null default '',
  email text not null,
  student_number text,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references profiles(id) on delete cascade,
  code text not null,
  title text not null,
  created_at timestamptz not null default now()
);

create table periods (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  instructor_id uuid not null references profiles(id) on delete cascade,
  label text not null check (label in ('1st Semester','2nd Semester','Midyear','Special Course')),
  created_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (student_id, course_id, period_id)
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  type assessment_type not null,
  total_points integer not null,
  questions jsonb not null,
  created_at timestamptz not null default now()
);

create table assessment_keys (
  assessment_id uuid primary key references assessments(id) on delete cascade,
  answer_key jsonb not null,
  created_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  instructor_id uuid not null references profiles(id) on delete cascade,
  pic text not null default '',
  opens_at timestamptz,
  closes_at timestamptz,
  due_date timestamptz,
  created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  instructor_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  earned integer,
  possible integer,
  score numeric,
  status submission_status not null default 'in_progress',
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table invites (
  token uuid primary key default gen_random_uuid(),
  email text not null,
  course_id uuid not null references courses(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  full_name text not null default '',
  student_number text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto-provision a profiles row whenever an auth user is created.
-- DETERMINISTIC: fixtures (createUser), acceptInvite, and the manual bootstrap
-- all rely on this trigger to materialize the matching profile. Trusts role from
-- user_metadata in Slice 1 ONLY because the sole creators of auth users are the
-- manual admin bootstrap and the server-controlled acceptInvite action (no public
-- self-signup). Slice 2 MUST stop trusting client metadata role.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, email, full_name, role, status, student_number)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student'),
    coalesce((new.raw_user_meta_data->>'status')::user_status, 'active'),
    nullif(new.raw_user_meta_data->>'student_number', '')
  )
  on conflict (id) do nothing;
  return new;
end
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Grants -------------------------------------------------------------------
-- service_role bypasses RLS and needs full DML for admin operations and tests.
-- anon + authenticated get full DML here; RLS policies (Task 3) restrict further.
grant select, insert, update, delete on
  public.profiles,
  public.courses,
  public.periods,
  public.enrollments,
  public.assessments,
  public.assessment_keys,
  public.assignments,
  public.submissions,
  public.invites
to service_role, anon, authenticated;
