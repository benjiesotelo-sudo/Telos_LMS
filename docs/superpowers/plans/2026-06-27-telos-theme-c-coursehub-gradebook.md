# Theme C — Course Hub + Assessment Management + FEU Gradebook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Class detail (course hub) with contents + enrolled students; per-assignment **period (Midterm/Final)**, **active on/off**, **reveal-answers** toggles + **per-class deadlines**; instructor **quiz preview + view correct answers**; and the **FEU gradebook by section** implementing the decoded model with **manual score override**.

**Architecture:** New schema on `assignments` (`period`, `active`, `reveal_answers`) and `classes` (weight config `wt_quiz`/`wt_paper`/`wt_exam`), plus a `grade_overrides` table (instructor manual score per student+assessment, priority over auto-grade). A pure `lib/gradebook.ts` computes per the decoded FEU model (per-category mean of item %s → period mark with 30/20/50 + no-papers fallback → course = avg(MT,FT) → transmute). The class-detail page and grades-by-section table read these. Server actions guard instructor/admin + use `refresh()` from `next/cache`.

**Reference spec (READ IT):** `docs/superpowers/specs/2026-06-26-feu-gradebook-model.md` — the exact computation, transmutation table, and manual-override rule.

**Tech stack:** Next.js (VENDORED — read `node_modules/next/dist/docs/`), Supabase, TypeScript, Vitest (LOCAL stack).

## Global Constraints
- **Answer-key secrecy:** `assessment_keys` stays service-role only. Instructor "view correct answers" reads it via a server action guarded to the owning instructor/admin — the key must NEVER be sent to a student client. Student answer-reveal (when `reveal_answers` ON + assessment closed) is served by a server action that returns the correct answers ONLY for that student's own closed submission.
- **Gradebook math must match the FEU model spec exactly** (category = mean of item %s of filled items; period mark 30/20/50 with no-papers→50/50 fallback; course = avg(MT,FT); transmutation table 50%=D…92%=A; manual override beats auto-grade; bonus may exceed 100).
- Tenant isolation + privilege-escalation guard intact; action tests use `setTestUser`.
- Vendored Next: mutations call `refresh()` from `next/cache` (vitest.setup.ts mocks it).
- Keep suite green + build passing each task. FEU theme classes.

## File map
- Migrations: `0008_assignment_meta.sql` (period/active/reveal on assignments; weight cols on classes), `0009_grade_overrides.sql`
- Lib: `lib/gradebook.ts` (NEW, pure), `lib/types.ts` (extend)
- Actions: `app/actions/getClassDetail.ts`, `app/actions/setAssignmentMeta.ts` (active/period/reveal/deadline), `app/actions/setClassWeights.ts`, `app/actions/setGradeOverride.ts`, `app/actions/getSectionGrades.ts`, `app/actions/getAssessmentKey.ts` (instructor view answers), `app/actions/getRevealedAnswers.ts` (student); modify `app/actions/createAssignment.ts` (period/active/reveal), `app/actions/getTakePayload.ts` (block inactive)
- UI: `app/instructor/classes/[classId]/page.tsx` (class detail) + panels (ContentsPanel, StudentsPanel, AssignmentMetaControls), `app/instructor/grades/page.tsx` (section picker → GradeSheet), `app/instructor/grades/GradeSheet.tsx`, instructor assessment preview (`app/instructor/assessments/[assessmentId]/page.tsx`), student results reveal (extend `app/student/results/[submissionId]/page.tsx`)
- Tests: `tests/gradebook.test.ts` (the model — heavy), `tests/grade-overrides.test.ts`, `tests/assignment-meta.test.ts`, `tests/section-grades.test.ts`, `tests/answer-reveal.test.ts`

---

### Task 1: `lib/gradebook.ts` — the FEU computation (pure, TDD-heavy)

**Files:** Create `lib/gradebook.ts`, `tests/gradebook.test.ts`; extend `lib/types.ts`.

**Interfaces:**
- `transmute(pct: number) → {letter, qp}` per the table (92–100 A/4 … 50–56 D/1 … <50 F/0).
- `categoryAverage(itemPercents: number[]) → number|null` — mean of provided percents (caller passes only filled items); null if empty.
- `periodMark({quizzes, papers, exam}: {quizzes:number|null, papers:number|null, exam:number|null}) → number|null` — if `papers==null`: `quizzes*0.5 + exam*0.5`; else `quizzes*0.3 + papers*0.2 + exam*0.5`; null if all null; treat a null category among the others per the spec's fallback (the no-papers fallback is the explicit case; if quizzes or exam is null, average the present categories' weights renormalized — DOCUMENT this choice in code). Accept optional weight override `{wtQuiz,wtPaper,wtExam}` (default 30/20/50).
- `courseMark(midterm:number|null, final:number|null) → number|null` — both null→null; one null→the other; else `round((mt+final)/2, 2)`.
- `gradeFor(pct:number|null) → {mark, letter, qp}|null`.

- [ ] **Step 1 — failing tests** in `tests/gradebook.test.ts` covering: transmute boundaries (49→F, 50→D, 56→D, 57→D+, 91→B+, 92→A, 100→A); categoryAverage (mean, empty→null, single item); periodMark with papers (30/20/50) and without papers (50/50) using the spec's own example numbers; courseMark (avg, one-empty, both-empty); a full end-to-end example matching a row from the spec. Write the expected numbers from `docs/superpowers/specs/2026-06-26-feu-gradebook-model.md`. Run → FAIL.
- [ ] **Step 2 — implement `lib/gradebook.ts`** to pass. Keep it PURE (no I/O). Document the renormalization choice for a missing quiz/exam category.
- [ ] **Step 3 — run → PASS; commit** `feat(gradebook): pure FEU grade computation (transmute/category/period/course)`

---

### Task 2: Migration — assignment meta + class weights

**Files:** Create `supabase/migrations/0008_assignment_meta.sql`; extend `tests/schema.test.ts`.

- [ ] **Step 1 — migration:**
```sql
-- 0008_assignment_meta.sql — per-assignment grading metadata + per-class weights.
create type grade_period as enum ('midterm','final');
alter table assignments add column period grade_period not null default 'midterm';
alter table assignments add column active boolean not null default true;
alter table assignments add column reveal_answers boolean not null default false;
alter table classes add column wt_quiz numeric not null default 0.30;
alter table classes add column wt_paper numeric not null default 0.20;
alter table classes add column wt_exam numeric not null default 0.50;
```
- [ ] **Step 2 — schema-test** asserts the new columns exist. `supabase db reset`; full suite green.
- [ ] **Step 3 — commit** `feat(db): assignment period/active/reveal + class weight config`

---

### Task 3: `createAssignment` + `setAssignmentMeta` + block inactive in take

**Files:** Modify `app/actions/createAssignment.ts`, `app/actions/getTakePayload.ts`; create `app/actions/setAssignmentMeta.ts`; `tests/assignment-meta.test.ts`.

**Interfaces:** `createAssignment` input gains `period`, `active?`(default true), `revealAnswers?`(default false) + keeps deadlines. `setAssignmentMeta({assignmentId, period?, active?, revealAnswers?, opensAt?, closesAt?, dueDate?}) → {ok}` (owner/admin guard; `refresh()`). `getTakePayload` throws/blocks if the assignment is `active=false`.

- [ ] **Step 1 — tests:** createAssignment stores period/active/reveal; setAssignmentMeta toggles them (owner only; non-owner rejected); getTakePayload on an inactive assignment is blocked. RED.
- [ ] **Step 2 — implement.** GREEN. `npm run build`. Commit `feat(assign): assignment meta (period/active/reveal/deadlines) + block inactive take`

---

### Task 4: `grade_overrides` + `setGradeOverride`

**Files:** Create `supabase/migrations/0009_grade_overrides.sql`, `app/actions/setGradeOverride.ts`; `tests/grade-overrides.test.ts`.

**Interfaces:** table `grade_overrides(id, student_id, assessment_id, class_id, score numeric, note text, instructor_id, created_at, unique(student_id, assessment_id, class_id))`. `setGradeOverride({studentId, assessmentId, classId, score, note?}) → {ok}` — owner/admin of the class; upsert; score may exceed 100 (bonus); `refresh()`. RLS: instructor/admin of the class only.

- [ ] **Step 1 — tests:** set an override; it upserts (second call updates); owner-only; score 105 allowed. RED → GREEN. Commit `feat(grades): manual grade override (priority over auto-grade)`

---

### Task 5: `getSectionGrades` — assemble the gradebook for a class

**Files:** Create `app/actions/getSectionGrades.ts`; `tests/section-grades.test.ts`.

**Interfaces:** `getSectionGrades({classId}) → SectionGrades` — owner/admin guard. For the class: enrolled students × assignments (grouped by period + category from assessment `type`), each cell = override score if present else the student's auto-graded submission % (or null if no submission). Uses `lib/gradebook.ts` to produce per-category averages, period marks, course mark + letter per student. Returns a structure the GradeSheet renders (adaptive columns by deployed assessments). Manual override takes priority.

- [ ] **Step 1 — tests:** seed a class + 2 students + a quiz (auto-graded submission) + a homework (override) + an exam; assert the computed period marks, course mark, and letter match `lib/gradebook.ts` expectations; assert override beats the auto score; assert a student with no submission shows null cells. RED → GREEN. Commit `feat(grades): getSectionGrades (FEU model + override priority)`

---

### Task 6: Class detail page (course hub)

**Files:** Create `app/actions/getClassDetail.ts`, `app/instructor/classes/[classId]/page.tsx` + `ContentsPanel.tsx` + `StudentsPanel.tsx` + `AssignmentMetaControls.tsx`; modify `app/actions/setClassWeights.ts`.

**Interfaces:** `getClassDetail({classId}) → {class, assessments[], students[]}` (owner/admin). `setClassWeights({classId, wtQuiz, wtPaper, wtExam}) → {ok}` (must sum to 1.0; owner/admin).

- [ ] **Step 1 — getClassDetail + setClassWeights actions** + tests (owner-only; weights validated). RED→GREEN.
- [ ] **Step 2 — class detail page** at `/instructor/classes/[classId]`: header (code·section·period·PIC), **Contents** (each assessment with its type/period + `active` toggle + deadline + `reveal_answers` toggle via AssignmentMetaControls → setAssignmentMeta), **Students** (enrolled list), and a weights editor (setClassWeights). The classes list rows already link here (Theme A6).
- [ ] **Step 3 — build + suite green; commit** `feat(classes): class detail hub (contents + students + meta toggles + weights)`

---

### Task 7: Grades by section (GradeSheet table)

**Files:** Rewrite `app/instructor/grades/page.tsx`; create `app/instructor/grades/GradeSheet.tsx`.

- [ ] **Step 1 — grades page:** a **section picker** (the instructor's classes) → on select, `getSectionGrades({classId})` → render `<GradeSheet/>`: a table of enrolled students × category averages (Quizzes/Papers-HW-SW/Exam per Midterm & Final) → period marks → **Course Mark + Letter**, adaptive columns. Each editable cell offers a manual-override input (calls setGradeOverride). Mirror the FEU sheet layout (Midterm group | Final group | Course Grade). FEU theme; readable, scrollable.
- [ ] **Step 2 — build + suite green; commit** `feat(grades): per-section FEU grade sheet with manual override entry`

---

### Task 8: Instructor quiz preview + view correct answers

**Files:** Create `app/actions/getAssessmentKey.ts`, `app/instructor/assessments/[assessmentId]/page.tsx`.

**Interfaces:** `getAssessmentKey({assessmentId}) → {questions, answerKey}` — guarded to the owning instructor/admin; reads `assessment_keys` via the service-role admin client. NEVER callable by a student (role guard). 

- [ ] **Step 1 — action + test:** owner gets questions + key; a student/non-owner `rejects.toThrow`. RED→GREEN.
- [ ] **Step 2 — preview page** at `/instructor/assessments/[assessmentId]`: renders the questions with the correct answers marked (instructor view). Link from the assessments list / class contents.
- [ ] **Step 3 — build + suite green; commit** `feat(assessments): instructor preview + view correct answers (key stays server-side)`

---

### Task 9: Student answer reveal (when enabled + closed)

**Files:** Create `app/actions/getRevealedAnswers.ts`; modify `app/student/results/[submissionId]/page.tsx`.

**Interfaces:** `getRevealedAnswers({submissionId}) → {questions, correctAnswers, myAnswers}|null` — for the STUDENT's OWN submission only; returns the correct answers ONLY when the assignment's `reveal_answers` is true AND it is closed (`closes_at` passed) AND the submission is graded; otherwise returns null (no reveal). The key is read service-role server-side and only the correct values for that closed assessment are returned to the owning student.

- [ ] **Step 1 — tests:** reveal returns answers when reveal_answers+closed+graded; returns null when reveal off OR not yet closed; another student cannot get a foreign submission's reveal. RED→GREEN.
- [ ] **Step 2 — results page:** when reveal is available, show correct answers next to the student's answers. Otherwise just the score (current behavior).
- [ ] **Step 3 — build + suite green; commit** `feat(student): post-close answer reveal when instructor enables it`

---

## Final verification (Theme C)
- [ ] `supabase db reset && npm test` — full suite green (gradebook math tests included).
- [ ] `npm run build` — passes; new routes compile.
- [ ] Manual: assign a quiz to a class with a period; toggle active/reveal; set a manual override; open Grades → pick the section → verify the computed marks/letters match the FEU model; instructor preview shows answers; student sees reveal only after close.
- [ ] Report to the user (Theme C ready) + smoke checklist + any documented judgment calls.
