-- 0009_grade_overrides.sql — instructor manual score override (priority over auto-grade).

create table grade_overrides (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  score numeric not null,           -- may exceed 100 (bonus)
  note text not null default '',
  instructor_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, assessment_id, class_id)
);

alter table grade_overrides enable row level security;

-- Instructor who owns the class (or admin) may read/write; the student MAY read their own.
create policy grade_overrides_rw on grade_overrides for all
  using (
    is_admin()
    or instructor_id = auth.uid()
    or exists (select 1 from classes cl where cl.id = class_id and cl.instructor_id = auth.uid())
  )
  with check (
    is_admin()
    or exists (select 1 from classes cl where cl.id = class_id and cl.instructor_id = auth.uid())
  );

create policy grade_overrides_student_read on grade_overrides for select
  using (student_id = auth.uid());

grant select, insert, update, delete on public.grade_overrides to service_role, anon, authenticated;
