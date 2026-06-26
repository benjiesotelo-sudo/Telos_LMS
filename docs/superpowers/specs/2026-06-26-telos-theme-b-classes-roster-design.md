# Theme B — Class/Course Building + Batch Roster — Design Spec (2026-06-26)

Part of the Slice 2 roadmap (`2026-06-26-telos-slice-2-roadmap.md`). Build order:
**B (this) → A → C → D**, with E hardening woven in. This is the foundational spine —
real classes that both dashboards render over.

## Goal
Replace today's single hardcoded course with **reusable Courses** and **Classes (sections)**
students enroll into, plus **batch enrollment** via on-demand, time-limited links with an
**instructor-approved pending flow**.

## Mental model
**Course** (reusable) → **Class/Section** (course + period + section label + PIC) →
**Roster** (approved students) → assessments assigned to the class → students take.
The **Class is the home object.** Display name = `code - section_label` (e.g. `AMS0011 - 6A`).

---

## Data model

```
courses        (reusable)   id, instructor_id, code, title, description          ← ADD description
classes  NEW   (= section)  id, instructor_id, course_id→courses, period,
                            section_label, pic, created_at
                            unique(course_id, period, section_label)
enrollments    (repointed)  student_id, class_id→classes, status                 ← was course_id+period_id
assignments    (repointed)  …, class_id→classes                                  ← was course_id+period_id
enroll_links NEW            id, token, instructor_id, kind('class'|'general'),
                            class_id (null for general), expires_at, revoked_at, created_at
profiles       (unchanged)  status enum already has 'pending' — reused
```

Deliberate decisions:
- **`period` is a column on `classes`** (check: `1st Semester` | `2nd Semester` | `Midyear` |
  `Special Course`). A class has exactly one period, so no join. The old course-scoped
  `periods` table is dropped.
- **PIC lives on `classes`** (a section property, shared by all its assessments). Stored as
  text. The create-class form offers a **picker of existing PIC values** (`select distinct
  pic from classes where instructor_id = me`) plus free-text to add a new one. PICs are
  reusable name values, not login accounts (future extension if needed).
- **`pic` removed from `assignments`** — assessments inherit PIC from their class.
- **The old single-use, instructor-pre-filled `invites` table is retired** after migration,
  replaced by `enroll_links` + student self-fill.

---

## UI & flows

### Course management (instructor / superadmin)
- "Courses" area: create/edit a Course (code, title, description). Reusable across terms.

### Class (section) management
- From a course: "Create class" → pick **period**, type **section label**, choose **PIC**
  (existing-PIC dropdown + add-new) → creates `AMS0011 - 6A`.
- **Class detail view** = home object: roster, assessments, enroll links, pending list.

### Enrollment — two links, both → pending → instructor approves

**Links are on-demand + time-limited with a live countdown:**
- A link does **not** exist until the instructor clicks "Generate." Once created, the class
  view shows the link **plus an active countdown timer** of remaining validity. On expiry the
  link is invalid (and visibly gone). Instructor can regenerate or revoke (`revoked_at`).
- **Class-join link** (`kind='class'`, default expiry **7 days**, configurable): tied to one
  section.
- **General invite link** (`kind='general'`, default expiry **2 days / 48 h**, configurable):
  not section-bound; registration form shows an **optional dropdown of open sections**.

**Registration form (student self-fill):** full name · student number · email · password.
- On submit → create auth user with `status='pending'`, role **forced to `student`
  server-side**. If a section is known (class-join link, or general-link dropdown choice),
  also create an enrollment `status='pending'`. If no section is known (general link, no
  choice), **no enrollment row yet** — the pending profile is the staging, and the enrollment
  is created when the instructor assigns a section at approval. Student is held at `/holding`
  until approved.

**Duplicate guard (keys on BOTH email and student number):**
- If email OR student number already exists, **block the sign-up** with a specific message
  naming the collision: *"This email (x@…) is already registered"* or *"Student number
  2021-00123 is already registered."*

**Pending dashboard (instructor):**
- List of pending registrants: name, student #, email, chosen section (if any).
- **Approve** → `status → active`, enrollment → active (assign section here if unset).
- **Reject** → remove the pending account.

**Cleanup sweep:**
- Scheduled job purges still-`pending` accounts past their link's `expires_at` (keeps
  `auth.users` clean — Approach 1's only downside, neutralized). Reuses the "Clean Test Data"
  admin-query idea from the backlog.

### Security invariants (non-negotiable, carried from Slice 1)
- Role forced to `student` **server-side** on every registration path — privilege-escalation
  guard (`0002_rls.sql`: no table-level UPDATE on `profiles`) stays intact.
- All link/registration/approval actions run as server actions using the admin client; the
  client never sets role or status.
- Tenant isolation: a student sees/joins only their own class; instructors see only their own
  courses/classes/links/pending.

---

## Migration
- Add `description` to `courses`; create `classes` + `enroll_links`; repoint
  `enrollments`/`assignments` to `class_id`; move `pic` onto `classes`; drop the
  course-scoped `periods` table.
- **Backfill the live pilot:** create one `classes` row for **AMS0011 · Midyear** and repoint
  its existing enrollment + assignments to it so the pilot keeps working unbroken. Retire the
  old `invites` table after backfill.

## Testing
- **RLS** (`tests/rls.test.ts`): a student sees/joins only their own class; cannot self-promote.
- **Duplicate guard:** second sign-up with a taken email OR student number is rejected with the
  field-specific message.
- **Approval transitions:** approve flips `status` + enrollment to active; reject removes the
  pending account; expired-pending accounts get swept by cleanup.
- **Link lifecycle:** a link past `expires_at` (or revoked) rejects registration.
- **Migration backfill:** the pilot's existing submission/enrollment survive intact.

## Out of scope (later themes)
- Instructor/student dashboards as full screens (Theme C/D) — this theme delivers the
  class detail view + management, not the dashboard home pages.
- Assessment authoring, timers, grading (Themes C/D).
- PICs as real user accounts (future).
