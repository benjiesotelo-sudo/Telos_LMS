# Theme B — Classes/Sections + Batch Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded course with reusable Courses and Classes (sections) that students enroll into via on-demand, time-limited links with an instructor-approved pending flow.

**Architecture:** A new `classes` table (= section: course + period + section_label + pic) becomes the object enrollments and assignments point to. The course-scoped `periods` table is dropped (period becomes a column on `classes`). A new `enroll_links` table backs two link kinds (`class` / `general`); students self-register into `status='pending'` and are held at `/holding` until an instructor approves. RLS helpers are rewritten from `(course_id, period_id)` to `class_id`. The live AMS0011·Midyear pilot is backfilled into a `classes` row so production stays unbroken.

**Tech Stack:** Next.js (vendored — read `node_modules/next/dist/docs/` before touching framework APIs), Supabase (Postgres + RLS + service-role admin client), TypeScript, Vitest against the LOCAL Supabase stack.

## Global Constraints

- **Answer key never reaches the client** — unchanged by this theme; do not alter `assessment_keys` access.
- **Privilege-escalation guard stays intact** — never re-grant table-level UPDATE on `profiles`; only `(full_name, student_number)` are authenticated-updatable. Role/status changes happen ONLY via the service-role admin client.
- **Role is forced to `student` server-side** on every registration path — never trust client metadata for role/status.
- **`createClient()` is async** — always `await` it.
- **Tests run against LOCAL Supabase only** (globalSetup asserts 127.0.0.1). Run `supabase start` + `npm test`.
- **Period check values:** `1st Semester` | `2nd Semester` | `Midyear` | `Special Course`.
- **Link expiry defaults:** class-join = 7 days; general = 2 days (48h). Both configurable.
- **Duplicate guard keys on BOTH email and student number**, with a field-specific message.
- Follow existing FEU UI classes (`feu-card`, `feu-input`, `feu-label`, `feu-btn-green`, `feu-btn-gold`, `feu-error`, `feu-muted`).

---

## File map

**Migrations**
- Create: `supabase/migrations/0003_classes_roster.sql` — schema reshape + RLS rewrite + pilot backfill.

**Lib / types**
- Modify: `lib/types.ts` — add `Period`, `EnrollLinkKind`, `ClassRow`, `PendingRegistrant` types.

**Server actions**
- Create: `app/actions/createCourse.ts`, `app/actions/createClass.ts`, `app/actions/listClasses.ts`, `app/actions/generateEnrollLink.ts`, `app/actions/registerViaLink.ts`, `app/actions/approvePending.ts`, `app/actions/rejectPending.ts`
- Modify: `app/actions/createAssignment.ts` (course_id+period_id → class_id), `app/actions/enrollStudent.ts` (delete — replaced by link flow)

**UI**
- Create: `app/instructor/CoursePanel.tsx`, `app/instructor/ClassPanel.tsx`, `app/instructor/EnrollLinksPanel.tsx`, `app/instructor/PendingPanel.tsx`, `app/register/[token]/page.tsx`, `app/register/[token]/RegisterForm.tsx`
- Modify: `app/instructor/page.tsx` (drive off classes), `app/instructor/AssignPanel.tsx` (class picker), delete `app/instructor/EnrollPanel.tsx`

**Tests / fixtures**
- Modify: `tests/helpers/fixtures.ts` (seedClass replaces seedPeriod; seedEnrollment + seedAssignment take classId), `tests/rls.test.ts`, `tests/schema.test.ts`, `tests/instructor.test.ts`, `tests/take.test.ts`, `tests/import.test.ts` (any referencing old shape)
- Create: `tests/classes.test.ts`, `tests/enroll-links.test.ts`, `tests/register.test.ts`

**Bootstrap**
- Modify: `supabase/seed.sql` — bootstrap a Class for the pilot instead of a bare course+period.

---

## Phase 1 — Schema migration (keep the suite green)

### Task 1: Migration `0003_classes_roster.sql`

**Files:**
- Create: `supabase/migrations/0003_classes_roster.sql`
- Test: `tests/schema.test.ts` (extend)

**Interfaces:**
- Produces tables: `classes(id, instructor_id, course_id, period, section_label, pic, created_at)`, `enroll_links(id, token, instructor_id, kind, class_id, expires_at, revoked_at, created_at)`; `courses.description`; `enrollments.class_id`; `assignments.class_id`. Drops: `periods`, `enrollments.course_id`, `enrollments.period_id`, `assignments.course_id`, `assignments.period_id`, `assignments.pic`, `invites` table.
- Produces RLS helpers: `is_enrolled_class(uuid)`, `is_enrolled_course(uuid)`, `instructs_student(uuid)`, `student_sees_assessment(uuid)` (rewritten).

- [ ] **Step 1: Write failing schema assertions**

Add to `tests/schema.test.ts` (use the existing `createAdminClient` pattern in that file):

```ts
it('classes table exists with section columns', async () => {
  const admin = createAdminClient()
  const { error } = await admin.from('classes')
    .select('id, instructor_id, course_id, period, section_label, pic').limit(0)
  expect(error).toBeNull()
})

it('enroll_links table exists', async () => {
  const admin = createAdminClient()
  const { error } = await admin.from('enroll_links')
    .select('id, token, instructor_id, kind, class_id, expires_at, revoked_at').limit(0)
  expect(error).toBeNull()
})

it('enrollments references class_id, not course_id', async () => {
  const admin = createAdminClient()
  const ok = await admin.from('enrollments').select('class_id').limit(0)
  expect(ok.error).toBeNull()
  const gone = await admin.from('enrollments').select('course_id').limit(0)
  expect(gone.error).not.toBeNull()
})

it('periods table is dropped', async () => {
  const admin = createAdminClient()
  const { error } = await admin.from('periods').select('id').limit(0)
  expect(error).not.toBeNull()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- schema`
Expected: FAIL — `classes`/`enroll_links` missing; `course_id` still selectable.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0003_classes_roster.sql`:

```sql
-- 0003_classes_roster.sql — Theme B: reusable courses + classes(sections) + enroll links.

-- 1) Drop policies/helpers that reference soon-to-change columns -------------
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
drop table periods;
drop table invites;

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

-- 9) Grants for new tables (RLS still restricts) -----------------------------
grant select, insert, update, delete on public.classes, public.enroll_links
  to service_role, anon, authenticated;
```

- [ ] **Step 4: Reset local DB and re-run**

Run: `supabase db reset` (re-applies 0001→0003 against the local stack), then `npm test -- schema`
Expected: PASS — all four new assertions green.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_classes_roster.sql tests/schema.test.ts
git commit -m "feat(db): classes/sections + enroll_links schema, class-based RLS, pilot backfill"
```

---

### Task 2: Update fixtures + repair existing tests

**Files:**
- Modify: `tests/helpers/fixtures.ts`
- Modify: `tests/rls.test.ts`, `tests/instructor.test.ts`, `tests/take.test.ts`, `tests/import.test.ts` (only where they call `seedPeriod`/`seedEnrollment`/`seedAssignment`)

**Interfaces:**
- Produces: `seedClass({instructorId, courseId, period, sectionLabel?, pic?}) → {id}`; `seedEnrollment({studentId, classId}) → {id}`; `seedAssignment({assessmentId, classId, instructorId, opensAt?, closesAt?}) → {id}`. Removes `seedPeriod`.

- [ ] **Step 1: Rewrite the three fixtures + drop seedPeriod**

Replace `seedPeriod`, `seedEnrollment`, `seedAssignment` in `tests/helpers/fixtures.ts`:

```ts
export async function seedClass(input: {
  instructorId: string
  courseId: string
  period: string
  sectionLabel?: string
  pic?: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('classes')
    .insert({
      instructor_id: input.instructorId,
      course_id: input.courseId,
      period: input.period,
      section_label: input.sectionLabel ?? '1',
      pic: input.pic ?? '',
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function seedEnrollment(input: {
  studentId: string
  classId: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('enrollments')
    .insert({ student_id: input.studentId, class_id: input.classId })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function seedAssignment(input: {
  assessmentId: string
  classId: string
  instructorId: string
  opensAt?: string
  closesAt?: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('assignments')
    .insert({
      assessment_id: input.assessmentId,
      class_id: input.classId,
      instructor_id: input.instructorId,
      opens_at: input.opensAt ?? null,
      closes_at: input.closesAt ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}
```

- [ ] **Step 2: Update callers in existing tests**

In each of `tests/rls.test.ts`, `tests/instructor.test.ts`, `tests/take.test.ts`, `tests/import.test.ts`: replace `seedPeriod(...)` + the `seedEnrollment({courseId, periodId})` / `seedAssignment({courseId, periodId})` calls with a `seedClass(...)` call and pass its `classId`. Example transform in `tests/rls.test.ts`:

```ts
// was: periodA = (await seedPeriod({courseId: courseA, instructorId: instrA.id, label: '1st Semester'})).id
//      await seedEnrollment({studentId: studentX.id, courseId: courseA, periodId: periodA})
const classA = (await seedClass({ instructorId: instrA.id, courseId: courseA, period: '1st Semester' })).id
await seedEnrollment({ studentId: studentX.id, classId: classA })
// assignment:
const assignmentA = (await seedAssignment({ assessmentId, classId: classA, instructorId: instrA.id })).id
```

Update the imports line in each file: remove `seedPeriod`, add `seedClass`.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS — all previously-green tests pass against the new shape (74/74 maintained, minus any period-specific assertions you removed).

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: migrate fixtures + existing tests to class_id model"
```

---

## Phase 2 — Server actions (TDD)

### Task 3: `createCourse` action

**Files:**
- Create: `app/actions/createCourse.ts`
- Test: `tests/classes.test.ts` (new)

**Interfaces:**
- Produces: `createCourse({code, title, description}) → {courseId}`. Caller must be instructor/admin; course is owned by the caller.

- [ ] **Step 1: Write failing test**

Create `tests/classes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { signInAs } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'
import { createCourse } from '@/app/actions/createCourse'

const PW = 'Test_pw_123!'
const tag = `cls-${Date.now()}`

describe('createCourse', () => {
  it('creates a course owned by the caller with a description', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'I' })
    await signInAs(instr.email, PW)
    const { courseId } = await createCourse({ code: `${tag}-AMS`, title: 'Algebra', description: 'Intro' })
    const admin = createAdminClient()
    const { data } = await admin.from('courses').select('instructor_id, description').eq('id', courseId).single()
    expect(data?.instructor_id).toBe(instr.id)
    expect(data?.description).toBe('Intro')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- classes`
Expected: FAIL — `createCourse` not found.

- [ ] **Step 3: Implement**

Create `app/actions/createCourse.ts` (mirror the auth/ownership guard pattern in `createAssignment.ts`):

```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function createCourse(input: {
  code: string; title: string; description?: string
}): Promise<{ courseId: string }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  if (!profile || (profile.role !== 'instructor' && profile.role !== 'admin')) {
    throw new Error('Forbidden: instructor or admin required')
  }
  const admin = createAdminClient()
  const { data, error: insErr } = await admin
    .from('courses')
    .insert({ instructor_id: auth.user.id, code: input.code, title: input.title, description: input.description ?? '' })
    .select('id')
    .single()
  if (insErr || !data) throw new Error(insErr?.message ?? 'Failed to create course')
  return { courseId: data.id }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- classes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/createCourse.ts tests/classes.test.ts
git commit -m "feat(actions): createCourse"
```

---

### Task 4: `createClass` + `listClasses` actions

**Files:**
- Create: `app/actions/createClass.ts`, `app/actions/listClasses.ts`
- Test: `tests/classes.test.ts` (extend)

**Interfaces:**
- Produces: `createClass({courseId, period, sectionLabel, pic}) → {classId}` (validates caller owns course; period in the 4 values). `listClasses() → ClassRow[]` for the caller, each `{id, courseId, code, title, period, sectionLabel, pic, displayName}`. Also `listPics() → string[]` (distinct existing pic values for the caller) — export from `listClasses.ts`.

- [ ] **Step 1: Write failing tests**

Append to `tests/classes.test.ts`:

```ts
import { createClass } from '@/app/actions/createClass'
import { listClasses, listPics } from '@/app/actions/listClasses'

describe('createClass + listClasses', () => {
  it('creates a section and lists it with a display name', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-i2@x.com`, password: PW, fullName: 'I2' })
    await signInAs(instr.email, PW)
    const { courseId } = await createCourse({ code: `${tag}-MATH`, title: 'Math', description: '' })
    const { classId } = await createClass({ courseId, period: 'Midyear', sectionLabel: '6A', pic: 'Prof X' })
    expect(classId).toBeTruthy()
    const rows = await listClasses()
    const row = rows.find((r) => r.id === classId)
    expect(row?.displayName).toBe(`${tag}-MATH - 6A`)
    expect(row?.pic).toBe('Prof X')
    const pics = await listPics()
    expect(pics).toContain('Prof X')
  })

  it('rejects a class for a course the caller does not own', async () => {
    const owner = await createUser({ role: 'instructor', email: `${tag}-own@x.com`, password: PW, fullName: 'O' })
    await signInAs(owner.email, PW)
    const { courseId } = await createCourse({ code: `${tag}-OWN`, title: 'Owned', description: '' })
    const other = await createUser({ role: 'instructor', email: `${tag}-oth@x.com`, password: PW, fullName: 'Oth' })
    await signInAs(other.email, PW)
    await expect(createClass({ courseId, period: 'Midyear', sectionLabel: '1', pic: '' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- classes`
Expected: FAIL — `createClass`/`listClasses` not found.

- [ ] **Step 3: Implement `createClass.ts`**

```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PERIODS = ['1st Semester', '2nd Semester', 'Midyear', 'Special Course']

export async function createClass(input: {
  courseId: string; period: string; sectionLabel: string; pic?: string
}): Promise<{ classId: string }> {
  if (!PERIODS.includes(input.period)) throw new Error('Invalid period')
  if (!input.sectionLabel.trim()) throw new Error('Section label required')
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const { data: course } = await admin.from('courses').select('id, instructor_id').eq('id', input.courseId).single()
  if (!course) throw new Error('Course not found')
  if (!isAdmin && course.instructor_id !== auth.user.id) throw new Error('Not the course owner')

  const { data, error: insErr } = await admin
    .from('classes')
    .insert({
      instructor_id: course.instructor_id,
      course_id: input.courseId,
      period: input.period,
      section_label: input.sectionLabel.trim(),
      pic: input.pic?.trim() ?? '',
    })
    .select('id')
    .single()
  if (insErr || !data) throw new Error(insErr?.message ?? 'Failed to create class')
  return { classId: data.id }
}
```

- [ ] **Step 4: Implement `listClasses.ts`**

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import type { ClassRow } from '@/lib/types'

export async function listClasses(): Promise<ClassRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('classes')
    .select('id, period, section_label, pic, course:course_id(code, title)')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((c: any) => ({
    id: c.id,
    courseId: c.course_id,
    code: c.course?.code ?? '',
    title: c.course?.title ?? '',
    period: c.period,
    sectionLabel: c.section_label,
    pic: c.pic ?? '',
    displayName: `${c.course?.code ?? ''} - ${c.section_label}`,
  }))
}

export async function listPics(): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('classes').select('pic')
  const set = new Set((data ?? []).map((r: any) => r.pic).filter((p: string) => p && p.trim()))
  return [...set].sort()
}
```

Add `ClassRow` to `lib/types.ts`:

```ts
export interface ClassRow {
  id: string
  courseId: string
  code: string
  title: string
  period: string
  sectionLabel: string
  pic: string
  displayName: string
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- classes`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/actions/createClass.ts app/actions/listClasses.ts lib/types.ts tests/classes.test.ts
git commit -m "feat(actions): createClass + listClasses + listPics"
```

---

### Task 5: `generateEnrollLink` action

**Files:**
- Create: `app/actions/generateEnrollLink.ts`
- Test: `tests/enroll-links.test.ts` (new)

**Interfaces:**
- Produces: `generateEnrollLink({kind, classId?, days?}) → {url, token, expiresAt}`. `kind='class'` requires `classId` (caller owns it); default days = 7. `kind='general'` ignores classId; default days = 2. Validates ownership.

- [ ] **Step 1: Write failing tests**

Create `tests/enroll-links.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { signInAs } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'

const PW = 'Test_pw_123!'
const tag = `lnk-${Date.now()}`

describe('generateEnrollLink', () => {
  it('class link defaults to 7-day expiry and embeds the token', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'I' })
    const courseId = (await seedCourse({ instructorId: instr.id, code: `${tag}-C`, title: 'C' })).id
    const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
    await signInAs(instr.email, PW)
    const res = await generateEnrollLink({ kind: 'class', classId })
    expect(res.url).toContain(res.token)
    const days = (new Date(res.expiresAt).getTime() - Date.now()) / 86400000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
  })

  it('general link defaults to 2-day expiry and has null class_id', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-g@x.com`, password: PW, fullName: 'G' })
    await signInAs(instr.email, PW)
    const res = await generateEnrollLink({ kind: 'general' })
    const admin = createAdminClient()
    const { data } = await admin.from('enroll_links').select('class_id, kind').eq('token', res.token).single()
    expect(data?.kind).toBe('general')
    expect(data?.class_id).toBeNull()
    const days = (new Date(res.expiresAt).getTime() - Date.now()) / 86400000
    expect(days).toBeGreaterThan(1.9)
    expect(days).toBeLessThan(2.1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- enroll-links`
Expected: FAIL — action not found.

- [ ] **Step 3: Implement**

```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function generateEnrollLink(input: {
  kind: 'class' | 'general'; classId?: string; days?: number
}): Promise<{ url: string; token: string; expiresAt: string }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  if (input.kind === 'class') {
    if (!input.classId) throw new Error('classId required for a class link')
    const { data: cls } = await admin.from('classes').select('id, instructor_id').eq('id', input.classId).single()
    if (!cls) throw new Error('Class not found')
    if (!isAdmin && cls.instructor_id !== auth.user.id) throw new Error('Not the class owner')
  }
  const days = input.days ?? (input.kind === 'class' ? 7 : 2)
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString()

  const { data, error: insErr } = await admin
    .from('enroll_links')
    .insert({
      instructor_id: auth.user.id,
      kind: input.kind,
      class_id: input.kind === 'class' ? input.classId : null,
      expires_at: expiresAt,
    })
    .select('token, expires_at')
    .single()
  if (insErr || !data) throw new Error(insErr?.message ?? 'Failed to create link')

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return { url: `${base}/register/${data.token}`, token: data.token, expiresAt: data.expires_at }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- enroll-links`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/generateEnrollLink.ts tests/enroll-links.test.ts
git commit -m "feat(actions): generateEnrollLink (class 7d / general 2d)"
```

---

### Task 6: `registerViaLink` action (self-fill + duplicate guard + pending)

**Files:**
- Create: `app/actions/registerViaLink.ts`
- Test: `tests/register.test.ts` (new)

**Interfaces:**
- Consumes: a valid `enroll_links.token`.
- Produces: `registerViaLink({token, fullName, email, password, studentNumber, classId?}) → {ok: true}`. Creates auth user `status='pending'`, role forced `student`; creates pending enrollment if a class is known (link's class_id, else `classId` arg for general links). Throws field-specific errors on duplicate email/student number, expired/revoked link.

- [ ] **Step 1: Write failing tests**

Create `tests/register.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { signInAs } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'
import { registerViaLink } from '@/app/actions/registerViaLink'

const PW = 'Test_pw_123!'
const tag = `reg-${Date.now()}`

async function instructorWithClassLink() {
  const instr = await createUser({ role: 'instructor', email: `${tag}-${Math.round(performance.now())}@x.com`, password: PW, fullName: 'I' })
  const courseId = (await seedCourse({ instructorId: instr.id, code: `${tag}-${Math.round(performance.now())}`, title: 'C' })).id
  const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
  await signInAs(instr.email, PW)
  const link = await generateEnrollLink({ kind: 'class', classId })
  return { instr, classId, token: link.token }
}

describe('registerViaLink', () => {
  it('creates a pending student + pending enrollment, role forced to student', async () => {
    const { classId, token } = await instructorWithClassLink()
    const email = `${tag}-stud@x.com`
    await registerViaLink({ token, fullName: 'Stud', email, password: PW, studentNumber: 'SN-1', classId: 'attacker-ignored' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id, role, status').eq('email', email).single()
    expect(prof?.role).toBe('student')
    expect(prof?.status).toBe('pending')
    const { data: enr } = await admin.from('enrollments').select('status, class_id').eq('student_id', prof!.id).single()
    expect(enr?.status).toBe('pending')
    expect(enr?.class_id).toBe(classId)
  })

  it('blocks a duplicate email with a field-specific message', async () => {
    const { token } = await instructorWithClassLink()
    const email = `${tag}-dupe@x.com`
    await registerViaLink({ token, fullName: 'A', email, password: PW, studentNumber: 'SN-A' })
    const { token: token2 } = await instructorWithClassLink()
    await expect(registerViaLink({ token: token2, fullName: 'B', email, password: PW, studentNumber: 'SN-B' }))
      .rejects.toThrow(/email .* already registered/i)
  })

  it('blocks a duplicate student number with a field-specific message', async () => {
    const { token } = await instructorWithClassLink()
    await registerViaLink({ token, fullName: 'A', email: `${tag}-sn1@x.com`, password: PW, studentNumber: 'SN-DUP' })
    const { token: token2 } = await instructorWithClassLink()
    await expect(registerViaLink({ token: token2, fullName: 'B', email: `${tag}-sn2@x.com`, password: PW, studentNumber: 'SN-DUP' }))
      .rejects.toThrow(/student number .* already registered/i)
  })

  it('rejects an expired link', async () => {
    const { token } = await instructorWithClassLink()
    const admin = createAdminClient()
    await admin.from('enroll_links').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('token', token)
    await expect(registerViaLink({ token, fullName: 'X', email: `${tag}-exp@x.com`, password: PW, studentNumber: 'SN-X' }))
      .rejects.toThrow(/expired/i)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- register`
Expected: FAIL — action not found.

- [ ] **Step 3: Implement**

```ts
'use server'
import { createAdminClient } from '@/lib/supabase/server'

export async function registerViaLink(input: {
  token: string; fullName: string; email: string; password: string
  studentNumber: string; classId?: string
}): Promise<{ ok: true }> {
  const admin = createAdminClient()

  // 1) Validate the link.
  const { data: link, error: linkErr } = await admin
    .from('enroll_links')
    .select('token, kind, class_id, expires_at, revoked_at')
    .eq('token', input.token)
    .single()
  if (linkErr || !link) throw new Error('Invalid registration link')
  if (link.revoked_at) throw new Error('This registration link was revoked')
  if (new Date(link.expires_at).getTime() <= Date.now()) throw new Error('This registration link has expired')

  // 2) Duplicate guard — field-specific.
  const email = input.email.trim().toLowerCase()
  const sn = input.studentNumber.trim()
  const { data: byEmail } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (byEmail) throw new Error(`This email (${email}) is already registered`)
  if (sn) {
    const { data: bySn } = await admin.from('profiles').select('id').eq('student_number', sn).maybeSingle()
    if (bySn) throw new Error(`Student number ${sn} is already registered`)
  }

  // 3) Resolve the target class (class link → its class; general → caller's choice).
  const classId = link.kind === 'class' ? link.class_id : (input.classId ?? null)

  // 4) Create the auth user — role forced to student, status pending.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { role: 'student', status: 'pending', full_name: input.fullName, student_number: sn },
  })
  if (createErr || !created.user) throw new Error(createErr?.message ?? 'Failed to create account')

  // 5) Pending enrollment only if a class is known.
  if (classId) {
    const { error: enrErr } = await admin
      .from('enrollments')
      .insert({ student_id: created.user.id, class_id: classId, status: 'pending' })
    if (enrErr) throw new Error(enrErr.message)
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- register`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/actions/registerViaLink.ts tests/register.test.ts
git commit -m "feat(actions): registerViaLink — self-fill, dup guard, pending"
```

---

### Task 7: `approvePending` + `rejectPending` actions

**Files:**
- Create: `app/actions/approvePending.ts`, `app/actions/rejectPending.ts`
- Test: `tests/register.test.ts` (extend)

**Interfaces:**
- Produces: `approvePending({studentId, classId?}) → {ok}` (flips profile `status→active`, enrollment(s) → active; if no enrollment exists and `classId` given, create active enrollment). `rejectPending({studentId}) → {ok}` (deletes the pending auth user → cascades profile/enrollment). Both require the caller to instruct that student (own class) or be admin.

- [ ] **Step 1: Write failing tests**

Append to `tests/register.test.ts`:

```ts
import { approvePending } from '@/app/actions/approvePending'
import { rejectPending } from '@/app/actions/rejectPending'

describe('approve / reject pending', () => {
  it('approve activates the profile and enrollment', async () => {
    const { instr, classId, token } = await instructorWithClassLink()
    const email = `${tag}-appr@x.com`
    await registerViaLink({ token, fullName: 'P', email, password: PW, studentNumber: 'SN-APPR' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
    await signInAs(instr.email, PW)
    await approvePending({ studentId: prof!.id })
    const { data: after } = await admin.from('profiles').select('status').eq('id', prof!.id).single()
    expect(after?.status).toBe('active')
    const { data: enr } = await admin.from('enrollments').select('status').eq('student_id', prof!.id).single()
    expect(enr?.status).toBe('active')
  })

  it('reject removes the pending account', async () => {
    const { instr, token } = await instructorWithClassLink()
    const email = `${tag}-rej@x.com`
    await registerViaLink({ token, fullName: 'R', email, password: PW, studentNumber: 'SN-REJ' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
    await signInAs(instr.email, PW)
    await rejectPending({ studentId: prof!.id })
    const { data: gone } = await admin.from('profiles').select('id').eq('id', prof!.id).maybeSingle()
    expect(gone).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- register`
Expected: FAIL — actions not found.

- [ ] **Step 3: Implement `approvePending.ts`**

```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function assertCanManage(studentId: string) {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')
  if (isAdmin) return
  // instructor: must instruct this student (share a class) OR student has no class yet
  const admin = createAdminClient()
  const { data: enr } = await admin
    .from('enrollments')
    .select('class_id, classes:class_id(instructor_id)')
    .eq('student_id', studentId)
  const owns = (enr ?? []).some((e: any) => e.classes?.instructor_id === auth.user!.id)
  const unplaced = (enr ?? []).length === 0
  if (!owns && !unplaced) throw new Error('Not your student')
}

export async function approvePending(input: { studentId: string; classId?: string }): Promise<{ ok: true }> {
  await assertCanManage(input.studentId)
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'active' }).eq('id', input.studentId)
  if (input.classId) {
    await admin.from('enrollments').upsert(
      { student_id: input.studentId, class_id: input.classId, status: 'active' },
      { onConflict: 'student_id,class_id' },
    )
  }
  await admin.from('enrollments').update({ status: 'active' }).eq('student_id', input.studentId)
  return { ok: true }
}
```

- [ ] **Step 4: Implement `rejectPending.ts`**

```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function rejectPending(input: { studentId: string }): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('status').eq('id', input.studentId).single()
  if (!target) throw new Error('Student not found')
  if (target.status !== 'pending') throw new Error('Refusing to delete a non-pending account')
  // Deleting the auth user cascades to profiles + enrollments (FK on delete cascade).
  const { error: delErr } = await admin.auth.admin.deleteUser(input.studentId)
  if (delErr) throw new Error(delErr.message)
  return { ok: true }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- register`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/actions/approvePending.ts app/actions/rejectPending.ts tests/register.test.ts
git commit -m "feat(actions): approve/reject pending registrants"
```

---

### Task 8: Repoint `createAssignment`; remove `enrollStudent`

**Files:**
- Modify: `app/actions/createAssignment.ts`
- Delete: `app/actions/enrollStudent.ts`
- Test: `tests/instructor.test.ts` (update assignment test to class_id)

**Interfaces:**
- Produces: `createAssignment({assessmentId, classId, opensAt?, closesAt?, dueDate?}) → {assignmentId}` (pic no longer an input — inherited from class).

- [ ] **Step 1: Update the test first**

In `tests/instructor.test.ts`, change the createAssignment call/inputs to the class shape:

```ts
const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
const { assignmentId } = await createAssignment({ assessmentId, classId })
expect(assignmentId).toBeTruthy()
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- instructor`
Expected: FAIL — `createAssignment` still expects `courseId`/`periodId`.

- [ ] **Step 3: Rewrite `createAssignment.ts`**

```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface CreateAssignmentInput {
  assessmentId: string
  classId: string
  opensAt?: string
  closesAt?: string
  dueDate?: string
}

export async function createAssignment(input: CreateAssignmentInput): Promise<{ assignmentId: string }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()
  const { data: cls, error: clsErr } = await admin
    .from('classes').select('id, instructor_id').eq('id', input.classId).single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  const { data: inserted, error: insErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: input.assessmentId,
      class_id: input.classId,
      instructor_id: cls.instructor_id,
      opens_at: input.opensAt ?? null,
      closes_at: input.closesAt ?? null,
      due_date: input.dueDate ?? null,
    })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error(`Failed to create assignment: ${insErr?.message ?? 'unknown'}`)
  return { assignmentId: inserted.id }
}
```

- [ ] **Step 4: Delete `enrollStudent.ts`**

```bash
git rm app/actions/enrollStudent.ts
```

(If `getTakePayload.ts` or `submitAssessment.ts` join through `assignments.course_id`/`period_id`, repoint those reads to `class_id` now and run `npm test -- take` to confirm green. They select by `assignment_id` so likely unaffected — verify.)

- [ ] **Step 5: Run to verify pass**

Run: `npm test`
Expected: PASS — full suite green.

- [ ] **Step 6: Commit**

```bash
git add app/actions/createAssignment.ts tests/instructor.test.ts
git commit -m "feat(actions): createAssignment by class_id; remove enrollStudent"
```

---

## Phase 3 — UI

### Task 9: Course + Class management panels

**Files:**
- Create: `app/instructor/CoursePanel.tsx`, `app/instructor/ClassPanel.tsx`
- Modify: `app/instructor/page.tsx`

**Interfaces:**
- Consumes: `createCourse`, `createClass`, `listClasses`, `listPics`.

- [ ] **Step 1: Implement `CoursePanel.tsx`** (client component; mirrors `ImportPanel` structure)

```tsx
'use client'
import { useState } from 'react'
import { createCourse } from '@/app/actions/createCourse'

export function CoursePanel() {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onCreate() {
    setBusy(true); setMsg('')
    try {
      await createCourse({ code, title, description })
      setMsg(`Created ${code}`); setCode(''); setTitle(''); setDescription('')
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="course-h" className="feu-card">
      <h2 id="course-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>New Course</h2>
      <label className="feu-label" htmlFor="c-code">Course Code</label>
      <input id="c-code" className="feu-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AMS0011" />
      <label className="feu-label" htmlFor="c-title">Title</label>
      <input id="c-title" className="feu-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Algebra and Trigonometry" />
      <label className="feu-label" htmlFor="c-desc">Description</label>
      <textarea id="c-desc" className="feu-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <div style={{ marginTop: 12 }}>
        <button type="button" className="feu-btn-gold" onClick={onCreate} disabled={busy || !code.trim() || !title.trim()}>
          {busy ? 'Creating…' : 'Create course'}
        </button>
      </div>
      {msg && <p role="status" className={msg.startsWith('Failed') ? 'feu-error' : 'feu-muted'} style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
```

- [ ] **Step 2: Implement `ClassPanel.tsx`** (takes server-fetched courses + existing pics as props)

```tsx
'use client'
import { useState } from 'react'
import { createClass } from '@/app/actions/createClass'

const PERIODS = ['1st Semester', '2nd Semester', 'Midyear', 'Special Course']

export function ClassPanel({ courses, pics }: { courses: { id: string; code: string }[]; pics: string[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [period, setPeriod] = useState('Midyear')
  const [sectionLabel, setSectionLabel] = useState('')
  const [pic, setPic] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onCreate() {
    setBusy(true); setMsg('')
    try {
      await createClass({ courseId, period, sectionLabel, pic })
      setMsg(`Created section ${sectionLabel}`); setSectionLabel('')
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="class-h" className="feu-card">
      <h2 id="class-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>New Class (Section)</h2>
      <label className="feu-label" htmlFor="cl-course">Course</label>
      <select id="cl-course" className="feu-input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
      </select>
      <label className="feu-label" htmlFor="cl-period">Period</label>
      <select id="cl-period" className="feu-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
        {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <label className="feu-label" htmlFor="cl-section">Section Label</label>
      <input id="cl-section" className="feu-input" value={sectionLabel} onChange={(e) => setSectionLabel(e.target.value)} placeholder="6A" />
      <label className="feu-label" htmlFor="cl-pic">PIC</label>
      <input id="cl-pic" className="feu-input" list="pic-options" value={pic} onChange={(e) => setPic(e.target.value)} placeholder="Person in charge" />
      <datalist id="pic-options">{pics.map((p) => <option key={p} value={p} />)}</datalist>
      <div style={{ marginTop: 12 }}>
        <button type="button" className="feu-btn-green" onClick={onCreate} disabled={busy || !courseId || !sectionLabel.trim()}>
          {busy ? 'Creating…' : 'Create class'}
        </button>
      </div>
      {msg && <p role="status" className={msg.startsWith('Failed') ? 'feu-error' : 'feu-muted'} style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
```

The PIC `datalist` satisfies "select from existing PICs or add a new one."

- [ ] **Step 3: Wire into `app/instructor/page.tsx`**

Fetch courses + pics server-side and render the panels. Replace the hardcoded single-course block:

```tsx
import { CoursePanel } from '@/app/instructor/CoursePanel'
import { ClassPanel } from '@/app/instructor/ClassPanel'
import { listPics } from '@/app/actions/listClasses'
// …inside the component, after auth check:
const { data: courses } = await supabase.from('courses').select('id, code').order('created_at')
const pics = await listPics()
// …in JSX:
<CoursePanel />
<ClassPanel courses={courses ?? []} pics={pics} />
```

- [ ] **Step 4: Build + manual smoke**

Run: `npm run build` (Expected: passes), then `npm run dev` and confirm you can create a course and a class.

- [ ] **Step 5: Commit**

```bash
git add app/instructor/CoursePanel.tsx app/instructor/ClassPanel.tsx app/instructor/page.tsx
git commit -m "feat(instructor): course + class (section) creation panels"
```

---

### Task 10: Enroll-links panel with live countdown + Pending panel

**Files:**
- Create: `app/instructor/EnrollLinksPanel.tsx`, `app/instructor/PendingPanel.tsx`
- Modify: `app/instructor/page.tsx` (render both; delete EnrollPanel usage), delete `app/instructor/EnrollPanel.tsx`

**Interfaces:**
- Consumes: `generateEnrollLink`, `approvePending`, `rejectPending`. Pending rows fetched server-side.

- [ ] **Step 1: Implement `EnrollLinksPanel.tsx`** — generate a link, then show a live `mm:ss`/`d h` countdown that disappears at expiry

```tsx
'use client'
import { useEffect, useState } from 'react'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'

function remaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`
}

export function EnrollLinksPanel({ classes }: { classes: { id: string; displayName: string }[] }) {
  const [kind, setKind] = useState<'class' | 'general'>('class')
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!link) return
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [link])

  async function onGenerate() {
    setBusy(true); setMsg('')
    try {
      const res = await generateEnrollLink(kind === 'class' ? { kind, classId } : { kind })
      setLink({ url: res.url, expiresAt: res.expiresAt })
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  const left = link ? remaining(link.expiresAt) : ''
  return (
    <section aria-labelledby="links-h" className="feu-card">
      <h2 id="links-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Enrollment Links</h2>
      <select className="feu-input" value={kind} onChange={(e) => setKind(e.target.value as 'class' | 'general')}>
        <option value="class">Class-join link (7 days)</option>
        <option value="general">General invite link (2 days)</option>
      </select>
      {kind === 'class' && (
        <select className="feu-input" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ marginTop: 8 }}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>
      )}
      <div style={{ marginTop: 12 }}>
        <button type="button" className="feu-btn-gold" onClick={onGenerate} disabled={busy || (kind === 'class' && !classId)}>
          {busy ? 'Generating…' : 'Generate link'}
        </button>
      </div>
      {link && left !== 'expired' && (
        <div style={{ marginTop: 14 }}>
          <input className="feu-input" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
          <p className="feu-muted" style={{ marginTop: 6 }}>Valid for <strong>{left}</strong></p>
        </div>
      )}
      {link && left === 'expired' && <p className="feu-error" style={{ marginTop: 10 }}>Link expired — generate a new one.</p>}
      {msg && <p role="status" className="feu-error" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
```

- [ ] **Step 2: Implement `PendingPanel.tsx`** (server-fetched rows in, approve/reject client actions)

```tsx
'use client'
import { useState } from 'react'
import { approvePending } from '@/app/actions/approvePending'
import { rejectPending } from '@/app/actions/rejectPending'

export interface PendingRow { studentId: string; fullName: string; email: string; studentNumber: string; className: string | null }

export function PendingPanel({ rows }: { rows: PendingRow[] }) {
  const [done, setDone] = useState<Record<string, string>>({})
  async function act(id: string, fn: () => Promise<unknown>, label: string) {
    try { await fn(); setDone((d) => ({ ...d, [id]: label })) }
    catch (e) { setDone((d) => ({ ...d, [id]: `Error: ${e instanceof Error ? e.message : String(e)}` })) }
  }
  return (
    <section aria-labelledby="pending-h" className="feu-card">
      <h2 id="pending-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Pending Registrations</h2>
      {rows.length === 0 && <p className="feu-muted">None pending.</p>}
      {rows.map((r) => (
        <div key={r.studentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line, #eee)' }}>
          <span>{r.fullName} · {r.email} · {r.studentNumber || '—'} · {r.className ?? 'unassigned'}</span>
          {done[r.studentId]
            ? <span className="feu-muted">{done[r.studentId]}</span>
            : <span style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="feu-btn-green" onClick={() => act(r.studentId, () => approvePending({ studentId: r.studentId }), 'Approved')}>Approve</button>
                <button type="button" className="feu-btn-gold" onClick={() => act(r.studentId, () => rejectPending({ studentId: r.studentId }), 'Rejected')}>Reject</button>
              </span>}
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Wire into `page.tsx`; fetch pending rows; delete EnrollPanel**

In `app/instructor/page.tsx`: query pending students the caller instructs and their class name, build `PendingRow[]`, render `<EnrollLinksPanel classes={…} />` and `<PendingPanel rows={…} />`. Remove the `EnrollPanel` import/use, then:

```bash
git rm app/instructor/EnrollPanel.tsx
```

- [ ] **Step 4: Build + manual smoke**

Run: `npm run build` (Expected: passes). `npm run dev`: generate a class link, watch the countdown tick, open `/register/<token>` in another tab, register, see the row appear in Pending, approve it.

- [ ] **Step 5: Commit**

```bash
git add app/instructor/EnrollLinksPanel.tsx app/instructor/PendingPanel.tsx app/instructor/page.tsx
git commit -m "feat(instructor): enroll-links panel w/ live countdown + pending approval"
```

---

### Task 11: Registration page `/register/[token]`

**Files:**
- Create: `app/register/[token]/page.tsx`, `app/register/[token]/RegisterForm.tsx`

**Interfaces:**
- Consumes: `registerViaLink`. The server page loads the link (via admin client) to decide validity + whether to show the section dropdown (general links).

- [ ] **Step 1: Implement the server page** (validates the link, passes props to the form)

```tsx
import { createAdminClient } from '@/lib/supabase/server'
import { RegisterForm } from './RegisterForm'

export default async function RegisterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()
  const { data: link } = await admin
    .from('enroll_links')
    .select('token, kind, class_id, expires_at, revoked_at')
    .eq('token', token).single()

  const invalid = !link || link.revoked_at || new Date(link!.expires_at).getTime() <= Date.now()
  let sections: { id: string; displayName: string }[] = []
  if (link && link.kind === 'general' && !invalid) {
    const { data } = await admin.from('classes').select('id, section_label, course:course_id(code)')
    sections = (data ?? []).map((c: any) => ({ id: c.id, displayName: `${c.course?.code ?? ''} - ${c.section_label}` }))
  }

  return (
    <>
      <header className="feu-header">
        <div className="feu-crest">T</div>
        <p className="feu-inst">Far Eastern University · Manila</p>
        <h1>Student Registration</h1>
      </header>
      <div className="feu-wrap">
        {invalid
          ? <div className="feu-card"><p className="feu-error">This registration link is invalid or has expired.</p></div>
          : <RegisterForm token={token} kind={link!.kind} sections={sections} />}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Implement `RegisterForm.tsx`** (self-fill fields; optional section dropdown for general links)

```tsx
'use client'
import { useState } from 'react'
import { registerViaLink } from '@/app/actions/registerViaLink'

export function RegisterForm({ token, kind, sections }: {
  token: string; kind: 'class' | 'general'; sections: { id: string; displayName: string }[]
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [password, setPassword] = useState('')
  const [classId, setClassId] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit() {
    setBusy(true); setMsg('')
    try {
      await registerViaLink({ token, fullName, email, password, studentNumber, classId: classId || undefined })
      setDone(true)
    } catch (e) {
      setMsg(`${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  if (done) return <div className="feu-card"><p className="feu-muted">Registration submitted. Your instructor will approve your account — you can log in once approved.</p></div>

  return (
    <section className="feu-card">
      <label className="feu-label" htmlFor="r-name">Full Name</label>
      <input id="r-name" className="feu-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <label className="feu-label" htmlFor="r-sn">Student Number</label>
      <input id="r-sn" className="feu-input" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
      <label className="feu-label" htmlFor="r-email">Email</label>
      <input id="r-email" className="feu-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="feu-label" htmlFor="r-pw">Password</label>
      <input id="r-pw" className="feu-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {kind === 'general' && (
        <>
          <label className="feu-label" htmlFor="r-sec">Section (optional)</label>
          <select id="r-sec" className="feu-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— pick later —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
          </select>
        </>
      )}
      <div style={{ marginTop: 14 }}>
        <button type="button" className="feu-btn-green" onClick={onSubmit}
          disabled={busy || !fullName.trim() || !email.trim() || !password || !studentNumber.trim()}>
          {busy ? 'Submitting…' : 'Register'}
        </button>
      </div>
      {msg && <p role="status" className="feu-error" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
```

- [ ] **Step 3: Build + manual smoke**

Run: `npm run build` (Expected: passes). `npm run dev`: open a class link → register → confirm the field-specific duplicate error when reusing an email; confirm the success state.

- [ ] **Step 4: Commit**

```bash
git add app/register/
git commit -m "feat(register): self-fill registration page via enroll link"
```

---

### Task 12: Repoint AssignPanel + seed.sql; cleanup sweep

**Files:**
- Modify: `app/instructor/AssignPanel.tsx` (class picker instead of course/period), `supabase/seed.sql`
- Create: cleanup function in a new migration `supabase/migrations/0004_pending_cleanup.sql`

**Interfaces:**
- Produces: `public.purge_expired_pending()` SQL function deleting pending profiles whose newest related link has expired.

- [ ] **Step 1: Update `AssignPanel.tsx`** to take a `classes` prop and pass `classId` to `createAssignment` (drop the pic input — inherited from class). Follow the existing AssignPanel structure; replace the course/period selection with a single class `<select>` of `displayName`.

- [ ] **Step 2: Write the cleanup migration**

Create `supabase/migrations/0004_pending_cleanup.sql`:

```sql
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
```

> Note: deletion cascades from `auth.users` → `profiles` → `enrollments`. Schedule via Supabase cron (pg_cron) or call manually from the SQL Editor; document in CONTINUE.md. Add a test in `tests/register.test.ts` that inserts a pending profile with `created_at` 8 days ago, calls `select purge_expired_pending()` via the admin client, and asserts the profile is gone.

- [ ] **Step 3: Update `seed.sql`** to bootstrap the pilot as a Class (course AMS0011 + a `classes` row, period Midyear, section '1') instead of course+period. Mirror the existing instructor-by-email lookup.

- [ ] **Step 4: Reset + full suite + build**

Run: `supabase db reset`, `npm test` (Expected: all green), `npm run build` (Expected: passes).

- [ ] **Step 5: Commit**

```bash
git add app/instructor/AssignPanel.tsx supabase/migrations/0004_pending_cleanup.sql supabase/seed.sql
git commit -m "feat(db): pending cleanup sweep; assign by class; seed a pilot class"
```

---

## Final verification

- [ ] `supabase db reset && npm test` — full suite green.
- [ ] `npm run build` — production build passes.
- [ ] Manual end-to-end: create course → create class (AMS0011 - 6A, PIC from datalist) → generate class link (watch countdown) → register a student in another tab → see them in Pending → approve → confirm they can log in and are held no longer.
- [ ] Update `CONTINUE.md`: mark Theme B done; note the `purge_expired_pending()` cron step; flag the pilot backfill ran.
