-- 0021_student_number_unique.sql — enforce one profile per student number.
--
-- Partial unique index: NULL/blank student numbers are exempt (instructors/admins, or
-- students created before a number was assigned). handle_new_user already maps '' -> NULL,
-- and the extra `<> ''` guard keeps any stray empty strings from colliding with each other.
--
-- PRE-FLIGHT: this CREATE fails (harmlessly — no partial state) if duplicates already exist
-- on the target DB. Before `supabase db push`, run the duplicate-check query in
-- docs/supabase-ops.md §1 and resolve any dupes first.

create unique index if not exists profiles_student_number_uniq
  on public.profiles (student_number)
  where student_number is not null and student_number <> '';
