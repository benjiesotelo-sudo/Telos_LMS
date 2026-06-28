# Telos_LMS — Continue Here

Multi-instructor learning-management system (the "Telos" brand). This is the at-a-glance handoff so any new session picks up fast.

## ▶▶ NEXT SESSION — RESUME HERE (set 2026-06-29)
**Where we are:** Theme D + hardening + 4-type taxonomy/graded toggle + all UX rounds are **BUILT, TESTED (289), REVIEWED (3×), and SHIPPED to production** (cloud migrated to 0019; `main` @ `db791b0`; Vercel live at https://telos-lms.vercel.app). **No code/features are pending** — the whole build agenda is done.

**Tomorrow's agenda (all NON-code — your hands / your call):**
1. **Live spot-check** — log into https://telos-lms.vercel.app as **yourself + a student** on real data; confirm the new UI (Assessment Settings, Admin Controls, student Dashboard tabs, Grades). If anything's off → tell Claude to fix-and-redeploy.
2. **Supabase SQL ops** (run in the cloud SQL Editor — Benjie's hands):
   - Schedule `select public.purge_expired_pending();` via **pg_cron** (purge >7-day stale pending).
   - Add a **unique index on `profiles.student_number`**.
   - **`handle_new_user` trigger**: keep public signups OFF or force `role=student` **before opening self-registration** (it still trusts metadata `role`).
   - Save admin SQL snippets: `List Users`, `Clean Test Data`, `Health Check`, `1st Setup`.
3. **Decision** (owner: Benjie): should `projects/Telos_AMS0011` graduate to its own repo? (Tracked in AIS-OS `decisions/log.md`.)
4. **Branch cleanup:** once the live spot-check passes, delete `feat/theme-d-student` (kept now as a safety net; already merged to main).
5. **Test data:** when done testing, run the scoped smoke-data cleanup SQL (in the "Test data" section below) — safe, cannot touch Mamoun/Benjie/AMS0011.

**How to deploy in future** (proven this session): `supabase db push --linked --yes` (migrate cloud FIRST) → `git push origin main` (Vercel deploys). Migrations are additive; always migrate before pushing code.


## Status (2026-06-26): Slice 1 LIVE + Theme B built on `feat/theme-b-classes-roster` (awaiting merge)
- **Deployed:** https://telos-lms.vercel.app  (Vercel — auto-deploys on push to `main`).
- **Backend:** Supabase cloud project `dprrunxkmsavqmbuzkwf`.  (NEVER touch the old `SOTELO_GradeBook` project `lvcdlulyvwbjrwvkmfwt`.)
- **Instructor login:** benjiesotelo@gmail.com.  Pilot class: AMS0011, period **Midyear**.
- **Tests:** `npm test` → **98/98** (on the Theme B branch).  Production `npm run build` passes.
- **What works (Slice 1):** instructor imports a JSON assessment → assigns it to a class → enrolls a student (copy-paste invite link) → student logs in, takes it, it auto-grades against a server-only answer key, both see the score. Email/password auth, RLS tenant isolation, client-side localStorage auto-save, single-submission integrity, FEU green/gold design.

### Theme B — Classes/Sections + Batch Roster (branch `feat/theme-b-classes-roster`, reviewed, ready to merge)
- **Model:** reusable **Courses** (code/title/description) → **Classes/sections** (course + period + section_label + PIC, shown `AMS0011 - 6A`) that enrollments + assignments now point to. `periods`/`invites` tables dropped; class-based RLS helpers; pilot AMS0011·Midyear backfilled into a class.
- **New flow:** instructor creates a course + class → generates an **enroll link** (class-join 7d / general 2d, on-demand, live countdown) → student self-registers at **`/register/[token]`** (name/student#/email/password; role forced `student`, `status=pending`) → lands in the instructor's **pending list** → instructor **approves/rejects**. Duplicate guard on email + student number. Migrations `0003`–`0005`.
- **DEPLOY TODO (cloud):** schedule `select public.purge_expired_pending();` via pg_cron (or a manual SQL-Editor sweep) to purge >7-day-stale pending accounts. Function is `revoke`d from anon/authenticated — service-role/SQL-Editor only.
- **Deferred follow-ups (non-blocking, from final review):** at approval, add a section-picker in PendingPanel for general-link registrants who joined with no section (currently they activate with no enrollment); add a DB unique index on `profiles.student_number`; tidy swallowed `profiles`-query errors in the actions; scope a couple of remaining cosmetic items (see `docs/superpowers/specs/2026-06-26-telos-theme-b-classes-roster-design.md` + the SDD ledger `.superpowers/sdd/progress.md`).

## Run it locally
Prereqs: **Docker Desktop running** + the **Supabase CLI** (`brew install supabase/tap/supabase`).
```bash
cd ~/Documents/Telos_LMS
supabase start     # boots the local stack (first run pulls images, slow)
npm run dev        # http://localhost:3000
npm test           # 74/74 — vitest runs against the LOCAL stack only
```
Tests run against the LOCAL Supabase stack (globalSetup asserts the URL is 127.0.0.1, so they can never hit the cloud). `.env.local` holds the cloud URL + keys for the dev server; the service-role key is secret + gitignored.

## Deploy
Push to `main` → Vercel rebuilds + redeploys automatically. Cloud DB migrations: `supabase link --project-ref dprrunxkmsavqmbuzkwf` then `supabase db push`. `seed.sql` is run manually in the Supabase SQL Editor — it bootstraps the instructor (looked up by email) + the pilot course/period.

### One-time cloud SQL steps (run in Supabase SQL Editor AFTER `supabase db push` of migrations 0006 + 0007)

> **Prerequisites:** migrations 0003–0007 must be applied (`supabase db push`). If earlier migrations (0003–0005) were already pushed, only 0006 and 0007 are needed.

**Benjie (super-admin)** — skip if you already ran `seed.sql` in the SQL Editor (it does this automatically):
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

**Mamoun (student)** — fill in `<mamoun_email>` before running (do not hardcode student email in the repo):
```sql
update public.profiles p
   set first_name     = 'Mamoun',
       middle_initial = 'F R',
       last_name      = 'Bani',
       prefix         = '',
       suffix         = '',
       student_number = '2024046681',
       full_name      = 'Mamoun F R Bani'
  from auth.users u
 where u.email = '<mamoun_email>'
   and p.id = u.id;
```
Replace `<mamoun_email>` with Mamoun's actual login email before executing.

## Full history lives in the AIS-OS repo (mission control)
- Plan: `~/Documents/AIS-OS/docs/superpowers/plans/2026-06-25-telos-lms-slice-1.md`
- Spec: `~/Documents/AIS-OS/docs/superpowers/specs/2026-06-25-telos-lms-design.md`
- Decisions + backlog: `~/Documents/AIS-OS/decisions/log.md` (2026-06-25 / 2026-06-26 entries)

## Architecture must-knows (do NOT regress)
- **Answer key never reaches the client.** Keys live in `assessment_keys` (RLS on, ZERO policies → service-role only). The take page serves only `assessments.questions`. `importAssessment` whitelist-rebuilds questions so no answer field is ever stored.
- **Tenant isolation** is RLS-enforced via a denormalized `instructor_id` (flat policies) + SECURITY DEFINER helpers; proven by `tests/rls.test.ts` with per-user clients.
- **Grading** (`lib/grading.ts`) is a verbatim port of the FEU `grading.html` / `verify_assessments.py` logic — `norm()` + pooled-by-points + bonus-excluded-from-possible; parity locked in `tests/grading.test.ts`. The import JSON is generated by `~/Documents/AIS-OS/projects/Telos_AMS0011/build/build_assessments.py` (`write_assessment_json`).
- **Privilege-escalation guard:** `0002_rls.sql` revokes table UPDATE on `profiles` and re-grants only `(full_name, student_number)` — a student can't self-promote to admin. Never re-grant table-level UPDATE on `profiles`.
- `createClient()` is **async** — always `await` it. The test-auth seam returns a per-user anon client under VITEST, never the service-role client.

## Slice 2 backlog (next)
**Full agenda + build order:** `docs/superpowers/specs/2026-06-26-telos-slice-2-roadmap.md`
Build order: **B (classes+roster) → A (profiles/roles) → C (instructor) → D (student) →** E hardening.
- **Theme B (START HERE):** real classes (course code + title/description, multi-course), per-class period/PIC, batch enrollment via invite link with student self-fill
- **Theme A:** profile view + logout (both roles), student detail-change requests, self-promote to super admin
- **Theme C:** instructor dashboard (assessments by type), manage/preview quiz + view correct answers, quiz name/description, quiz timer setting, fast assign-to-class
- **Theme D:** student dashboard, view classes, view class details (deadlines/timers), pre-quiz screen, live countdown + auto-submit
- **Theme E (woven in):** server-side auto-save + cross-device resume; status enforcement; transactional `importAssessment`; BEFORE-UPDATE role trigger on `profiles`; duplicate-invite guard; `middleware`→`proxy` rename; N+1 student-dashboard query; saved Supabase admin SQL (`List Users`, `Clean Test Data`, `Health Check`, `1st Setup`)
- Also pending: weighted **gradebook** + CSV export

## To continue
`cd ~/Documents/Telos_LMS`, start a Claude session here, say "continue the Telos_LMS build."

## 2026-06-27 — Slice 2 build on branch `feat/theme-n-app-shell` (verified; cloud migrated to 0010; NOT merged to main)
Large autonomous build. Branch ~45 commits beyond main. Verified: **231 tests green, build clean, headless e2e 12/12**. Cloud DB migrated through **0010** (all additive). **Production (main) still = Theme B era** until merged.

### Built on the branch (each task two-stage reviewed + tested)
- **Theme N — App Shell:** left-sidebar nav (instructor + student), routed pages, enroll-link management (list active / reuse / revoke / live countdown), no-refresh via server-side `refresh()` from `next/cache`.
- **Theme A — Identity:** structured names (prefix/first/MI/last/suffix → auto `full_name`); registration collects them; profile view/edit; **change-password** (`/account/password`) + **reset-recovery** (`/reset-password`) pages + login "Forgot password"; **super-admin (`admin`) account management** (`/instructor/users`: CRUD users + reset password; last-admin/self-demotion lockout guard). Seed makes Benjie super-admin `Benjamin C. Sotelo`; Mamoun cloud-update documented.
- **Theme C — Course hub + FEU gradebook:** two-level **Courses & Classes** (course → sections → class detail); class detail (contents + enrolled students + editable **period/section** + **weights**); per-assignment **period(Midterm/Final)/active/reveal** toggles + deadlines; **FEU grade sheet by section** (model: `docs/superpowers/specs/2026-06-26-feu-gradebook-model.md`); **manual score override = raw score / total_points → %** (bonus may exceed 100); instructor **preview + view answers** (key stays server-side); **student answer reveal** only when enabled+closed+graded.
- **Manual assessments:** `is_manual` assessments (name+type+points, NOT takeable online); created on Assessments page (block under Import); assigned via an **assessment dropdown** (pick by name, no IDs); graded in the sheet (raw score).
- **e2e harness:** `e2e/seed.mjs` + `e2e/smoke.mjs` (Playwright). To run: `supabase db reset` → `node e2e/seed.mjs` → start a LOCAL-pointed dev server on :3100 (inline NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 + local anon/service keys + PORT=3100) → `node e2e/smoke.mjs`. Logs in as `e2e-admin@local.test` / `E2e_admin_pass123!`, loads every page, flags loops/console/page errors/stuck-loading.

### Migrations (cloud now at 0010): 0006 name fields · 0007 trigger copies names · 0008 assignment period/active/reveal + class weights · 0009 grade_overrides · 0010 is_manual.

### LEFT TO DO
1. **Merge branch → `main`** to ship everything to production (cloud already migrated to 0010). Pattern: `git checkout main && git merge feat/theme-n-app-shell`, run `npm test` on merged main, `git push origin main` (Vercel auto-deploys), delete branch.
2. **User's final check** pending: assign a manual assessment (dropdown) + enter a raw grade in the sheet.
3. **Theme D** (student experience: real dashboards, view classes/details, pre-quiz screen, live quiz timer + auto-submit) — NOT started.
4. **Theme E / deferred follow-ups:** `handle_new_user` trigger still trusts metadata `role` → ensure cloud signups OFF or force role=student; section-picker for unplaced general-link registrants at approval; `student_number` DB unique index; schedule `purge_expired_pending()` via pg_cron; `middleware`→`proxy` rename; misc review minors logged in `.superpowers/sdd/progress.md`.

### DEV-MODE GOTCHA (not a bug): long-running `next dev` + an open tab loops repeated GETs after many hot-reloads (esp. while files are being edited). e2e on a fresh browser = 0 loops; production (built app) unaffected. Fix: restart `npm run dev` + hard-reload (Cmd+Shift+R).

### AGENTS.md rules added this session: (1) no frozen-looking screens (loading.tsx + pending buttons); (2) `'use server'` files may export ONLY async actions — never a const/array (a client import of such a const crashes at runtime while the build still passes).

### NEXT-SESSION feature: split the Grades view into two tables (requested 2026-06-27)
- **Top = Grade Sheet (read-only):** the existing FEU computed table (category %s → MG/FG → Course MARK + LG). The submit-report; remove inline editing from it.
- **Bottom = Grade Editor (editable):** a separate table, rows = students, columns = each assessment, each cell shows **raw score / max points** (e.g. `85 / 100`) and is editable. Editing sets the grade_override (raw, out of `total_points`); it flows up into the top sheet (server `refresh()`). Online auto-graded items show their auto score/possible; manual items show the entered score/total_points.
- Files: `app/instructor/grades/GradeSheet.tsx` (split into a read-only sheet + a `GradeEditor` component), `app/instructor/grades/page.tsx`. Data already in `getSectionGrades` (`cells` %, `rawOverrides`, `totalPoints` per assessment).
- **Perf:** `getSectionGrades` does ~5 sequential cloud queries — parallelize with `Promise.all` to speed up the grades page. (Dev-mode + cloud latency is the main slowness; production/Vercel is much faster.)

## ✅ GRADE EDITOR — REDESIGNED to two-grid layout (2026-06-28) — MERGED to `main` + pushed (Vercel auto-deploying)
After trying the first cut (per-assessment dropdown editor), the user asked for a grid that mirrors the sheet + safe revert. Final shape (spec `docs/superpowers/specs/2026-06-28-grade-editor-grid-redesign-design.md`, plan `docs/superpowers/plans/2026-06-28-grade-editor-grid-redesign.md`):
- **Grade Sheet (top, read-only):** heading "Grade Sheet"; computed FEU table with **`%` signs** on every value (cells + MG/FG/Course Mark); numbers score-colored; **amber tint + `•` dot** marks any hand-edited grade so you can see at a glance which were manual vs auto.
- **Grade Editor (bottom, editable):** a full grid **identical in columns** to the sheet. **Every assessment cell is always an input** `raw /total` (no click-to-edit — user preference 2026-06-28; Tab moves across cells), prefilled with current effective score (override → auto → blank). **MG/FG/Course Mark/LG recompute LIVE** as you type. Edited cells get a blue outline (saved manual grades show amber tint + a `•`); one **Save changes (N edited)** button batches all edits across many cells/assessments in one write; a **Discard** link resets. **Safe revert** appears only on overridden cells: online → `↺` (revert to auto); manual → `✕` (clear) with a single **Save-time confirm** before erasing a manual-only score.

Verified: **239 tests green** (was 237; +2 `computeStudentMarks`), **`npm run build` clean**, **e2e smoke 12/12** (1 self-request each — no dev loop), and a Playwright interaction test **8/8** (live MG preview before save; no write until Save; Save creates override≠auto; Grade Sheet shows new % + amber dot; ↺ revert deletes; Clear+confirm deletes). Screenshot: `e2e/shots/grade-editor-v2.png`.

### What changed (this redesign)
- **`lib/gradebook.ts`:** extracted **`computeStudentMarks(cells, assessments, weights)`** — the single source of truth for MG/FG/Course/letter, now used by BOTH `getSectionGrades` (server) and the editor live preview (client), so the preview can't drift.
- **`app/actions/setGradeOverrides.ts`:** generalized to **`{ classId, entries: [{ studentId, assessmentId, score: number|null }] }`** — one owner-guard, bulk upsert (score≠null), grouped deletes (score==null), one `refresh()`. (Earlier per-assessment shape is gone.)
- **`app/instructor/grades/`:** `gradeStyles.ts` (new shared color/marker/layout helpers); `GradeSheet.tsx` rewritten read-only (no more click-to-edit / header-selection); `GradeEditor.tsx` rewritten as the editable grid (cells rendered via a function, not a child component, to keep input focus while typing); `GradesView.tsx` **removed** — `page.tsx` renders `<GradeSheet>` then `<GradeEditor>` directly.
- Kept from the first cut: per-student `autoRaw` in `getSectionGrades` (+ parallelized reads); `deleteGradeOverride` action (now unused by the UI — reverts go through the batch Save — but retained + tested).
- **≠-auto rule (Mamoun-311% safeguard) preserved:** an override is written only when the entered value differs from the auto value; matching auto / clearing deletes it.

### SHIPPED
Merged `feat/grade-editor` → `main` and pushed (commit `3e7823d`; 8 grade-editor commits + 3 prior unpushed docs commits). 239 tests green on merged main; build clean. No new migrations — additive code only; cloud DB already at 0010. Vercel auto-deploys `main` → https://telos-lms.vercel.app. Local feature branch deleted.

### NEXT
- **Verify the live deploy** once Vercel finishes: open https://telos-lms.vercel.app/instructor/grades on a real section and spot-check the editor.

## 🌙 OVERNIGHT BUILD (2026-06-28→29) — Theme D + invites + removals + timer + CSV — branch `feat/theme-d-student` (LOCAL ONLY, not pushed/merged)
Autonomous build per the agreed design. **264 tests green** (was 239; +25), **`npm run build` clean**, **e2e smoke 12/12** (instructor), and a **student-side smoke** (login + load /student, /student/todo, /student/grades, class detail — no page/console errors, nothing stuck). Screenshots: `e2e/shots/student-dashboard.png`, `e2e/shots/grade-editor-v3.png`.

### Built (each tested)
- **Reveal rule now type-aware** (`getRevealedAnswers`): homework reveals immediately when graded; quiz/exam reveal only after the **close date** (a quiz/exam with no close date never reveals — by design).
- **Student data layer** (`getStudentData.ts`, no N+1): `getStudentOverview`, `getStudentClassDetail`, `getStudentTodo`, `getStudentGrades`.
- **Student app**: nav = **Dashboard / To-Do / Grades / Profile**. Dashboard = My Classes with grouped tasks (Quizzes/Homework/Exams) + status/score + Take/Review links; **class detail** (`/student/classes/[classId]`) with per-class to-do; **To-Do** page (all open tasks across classes); **Grades** page (read-only FEU breakdown). Shared `TaskList`.
- **Quiz timer** (migration 0011): default duration on the assessment (`DurationSetting` on the assessment page) → pre-fills the per-section `assignments.duration_minutes` at assign time, editable via `setAssignmentMeta`. `startAttempt` records first-open once (`quiz_attempts`); **keeps running** across refresh; `TakeForm` shows a live countdown + **auto-submits at zero**. (Limitation: a never-reopened closed tab stays `in_progress` until a server sweep — hardening follow-up.)
- **In-app invites** (migration 0012, `enrollments.status='invited'`): instructor searches existing students by name/email/student# on the class page → invites; student sees a **Class invites** panel on the dashboard → **Accept** (→active) / **Decline**.
- **Removal requests** (migration 0013): instructor "Request removal" (reason) on the class roster → **admin** reviews at **`/instructor/removals`** → Approve (deletes enrollment) / Reject. Instructor sees "Removal pending".
- **Gradebook CSV export**: "Export CSV" on the Grade Sheet downloads the per-section computed sheet.

### ✅ SHIPPED to production (2026-06-29) — commit `8d081f2` on `main`
Theme D + hardening + taxonomy/graded + all UX rounds are LIVE.
- **Cloud DB migrated to 0019** via `supabase db push --linked` (0011–0019 applied; verified each new object exists on cloud: `assessments.is_graded`, `quiz_attempts`/`answers`/`started_at`, `enrollment_removal_requests`, `profiles.join_reason`, `assignments.duration_minutes`). The `homework` enum value + RLS/trigger/RPC all applied. (A post-apply pgdelta "catalog cache" warning appeared — cosmetic, migrations applied fine.)
- **Code pushed** `4c2c9a5..8d081f2` → Vercel auto-deploy. Production health check: `/`, `/login`, `/register/x` → 200.
- **Order honored:** migrate-first, then push — no code-ahead-of-schema window.
- ⏳ **Benjie's spot-check pending:** log in at https://telos-lms.vercel.app as yourself (and as a student) to confirm the new UI on real data. Then `feat/theme-d-student` can be deleted (kept for now).

### ⚠️ Original note — BEFORE MERGING this branch to main
- It adds **migrations 0011–0019** — cloud DB is still at 0010. After merge you MUST `supabase db push` (link to `dprrunxkmsavqmbuzkwf`) so production gets the new columns/tables/enum value, else the live app errors. (Local test DB already has them.)
- Branch is **not pushed** and **not merged** — it's local for your morning review.

### Morning review — run it locally
`cd ~/Documents/Telos_LMS` → `supabase start` → `npm run dev` → open http://localhost:3000. Log in as instructor to try: assessment default time limit, invite a student on a class page, "Request removal" + approve at /instructor/removals, Export CSV on Grades. Then log in as a student (or use the e2e student on a :3100 local-pointed server) to see Dashboard/To-Do/Grades, take a timed quiz (countdown + auto-submit), and accept a class invite. Tests: `npm test` (264). NOTE: deferred — hardening items below are NOT done; student-side pages aren't in the headless smoke yet.

## 📋 REMAINING LMS WORK — canonical checklist (2026-06-28)
Single source of truth for what's left to build. Order reflects "student experience first."

### Features — ✅ ALL BUILT (branch `feat/theme-d-student`, local)
1. ✅ **Theme D — Student experience** — Dashboard (To-Do/Done tabs) / Classes / Grades / class-detail + **pre-quiz screen** (built via getAttemptStatus + TakeGate).
2. ✅ **Quiz timer + live countdown + auto-submit** (migration 0011).
3. ✅ **Student answer review (type-aware reveal)**.
4. ✅ **Invite existing users + in-app accept/decline** (migration 0012).
5. ✅ **Manage students + removal-request approval** (migration 0013).
6. ✅ **Gradebook CSV export**.
   - No code features remain. Plus the 2026-06-29 rounds: assessment settings, 4-type taxonomy + graded toggle, Admin Controls hub, sticky sidebar, Users search + pinned actions, pending-list redesign + join reason.

### Hardening — ✅ ALL BUILT this session (migrations 0014–0017, branch `feat/theme-d-student`)
- ✅ Server-side auto-save + cross-device resume — `quiz_attempts.answers` (0017) + `saveDraft`/`getDraft`; TakeForm saves to localStorage + server, resumes from server.
- ✅ Status enforcement — `is_active()` (0014) AND-ed into assignments/assessments select policies + status re-check in `getTakePayload` & `submitAssessment`.
- ✅ Transactional `importAssessment` — `import_assessment()` RPC (0016), single transaction, no orphan rows.
- ✅ BEFORE-UPDATE role/status guard trigger on `profiles` (0015) — regression-proof even if table UPDATE is re-granted.
- ✅ Pre-quiz screen — timer starts on Start click (getAttemptStatus read-only + TakeGate).
- ✅ Swallowed `profiles`-query errors tidied (registerViaLink dup-guard fail-closed; approvePending write-error checks).
- ✅ Section-picker at approval for unplaced general-link registrants (PendingPanel).
- ✅ `middleware` → `proxy` rename (Next 16 convention).
- ✅ Student pages added to the e2e smoke (16/16: 12 instructor + 4 student).
- Obsolete (no longer applies): "instructor enroll/assign defaults to first course" (enrollment lists all classes, assign is class-scoped); "student-dashboard N+1" (replaced by getStudentOverview batched queries).
### UI refinements (2026-06-29, from user review — same branch)
After reviewing, the user asked for: (1) **Assessment Settings** — edit name / type / **default timer** on the assessment page (`updateAssessmentSettings`); (2) **timer adjustable when assigning** — a Time-limit field on the per-section assignment controls + at assign time; (3) **"Removals" → "Admin Controls"** — a hub with **Users + Removal requests** as tabs (`/instructor/admin`; old routes redirect); (4) **Student Dashboard = To-Do + Done** (dated; To-Do by deadline, Done by submit date/time; standalone `/student/todo` removed); (5) **Student Classes** list page (pick a class → contents). Student nav: Dashboard / Classes / Grades / Profile. A 2nd adversarial review found 4 issues — all fixed (getStudentDone excludes manual; submitted tasks never show a deadline; assignment-duration save no-ops when unchanged; assessment-settings errors render red).

### Taxonomy + graded + UX round (2026-06-29, from user review — same branch)
- **Assessment types are now four tags** (Quiz [Q] · Homework [H] · Activity [P] · Exam [E], via `lib/assessmentType`). Homework + Activity both grade in the **Papers/HW 20%** bucket (migration 0018 adds the `homework` enum value). Mismatched labels ("Paper/Activity" vs "Homework/Activity") fixed everywhere.
- **Graded/ungraded toggle** (migration 0018 `assessments.is_graded`, default true): homework/activity can be marked **practice (ungraded)** — still shows a score for feedback but is **excluded from MG/FG/course marks** (computeStudentMarks + getSectionGrades + getStudentData + editor preview all honor it). Quiz/exam are **always graded** (enforced server-side). Ungraded marker shown in the grade sheet + student lists.
- **Assessment Settings** card edits **name / type / default timer / graded** (`updateAssessmentSettings`); per-section **time-limit** field on assignment controls + at assign time.
- **Admin Controls** hub (`/instructor/admin`) = Users + Removal-requests tabs (old routes redirect). **Sticky sidebar**; compact Users action buttons.
- **Pending registrations** split into **Needs a section / Joined a section** with a clean row format + an **optional join reason** (migration 0019 `profiles.join_reason`, captured at registration, cleared on approval).
- **Student Dashboard** = **To-Do | Done tabs** (Google-Classroom style).
- Verification: **289 unit tests green**, `npm run build` clean, e2e smoke 16/16. **THREE adversarial multi-agent reviews** total (each: 4 dimensions → verify): all confirmed findings fixed (graded-only submissions; no frozen invite/removal buttons; invite-target must be a student; getDraft enrollment guard; consistent `homework` casts/labels). ⚠️ Cloud still at 0010 — `supabase db push` of migrations **0011–0019** required before/after merge.

#### (prior round) UI refinements: 285 tests, 2 reviews — superseded by the line above.

### Cloud/ops (run in Supabase dashboard — Benjie's hands, not code)
- Schedule `purge_expired_pending()` via pg_cron.
- DB unique index on `profiles.student_number`.
- `handle_new_user` trigger: keep signups OFF or force `role=student` before opening registration.
- Save admin SQL snippets: `List Users`, `Clean Test Data`, `Health Check`, `1st Setup`.

### Out of session scope (decision, not a build) — tracked in AIS-OS log
- Whether `projects/Telos_AMS0011` should graduate to its own repo (owner: Benjie).

### Test data: INTENTIONALLY KEPT (user still testing — 2026-06-28)
The 6 Smoke Student accounts (+smoke emails / SMOKE-* numbers), SMOKE101 course/class, and "Homework Smoke 1" are deliberately retained for now. Do NOT clean them until the user says so. When ready, the SCOPED, verified-safe cleanup (cannot touch Mamoun/Benjie/AMS0011) is:
```sql
delete from auth.users where email ilike '%+smoke%';
delete from public.courses where code = 'SMOKE101';
delete from public.assessments where title ilike 'Homework Smoke%';
```
Note: the user's earlier (unscoped) "Clean Test Data" query did NOT remove these but DID delete a stale grade_override — which fortuitously fixed a bug (see below).

### Resolved 2026-06-28: Mamoun's quiz showed 311% — fixed (data, not code)
Cause: a leftover grade_override (score=93.33) created under the pre-M3 "%-as-override" meaning; M3's new raw/total_points math read it as 93.33÷30×100=311%. The override is now deleted, so Mamoun shows his correct auto-grade (28/30 = 93.33%). FOLLOW-UPS for the grade-editor task: (1) clearing a grade cell should DELETE the override (revert to auto) — there's currently no UI to undo an override; (2) the M3 semantic change can mis-read any override stored before it — sweep for others (likely none left).

## ★ GRADE EDITOR — FINAL CHOSEN DESIGN (2026-06-28) — supersedes the earlier "two-table" note
User picked **Option 1: per-assessment entry** (read-only computed sheet + a focused one-assessment editor). Build this.

**Layout** (`app/instructor/grades/`):
- **Top — read-only FEU sheet:** the existing computed table (category %s → MG/FG → Course MARK + LG). **Strip ALL inline editing from it** — it becomes the submit-report only.
- **Bottom — per-assessment editor:** a control to choose ONE assessment (a dropdown, AND/OR clicking that assessment's column header in the top sheet selects it). Then a list of enrolled students, each row: `[ score ] / {total_points}`, plus for online items the **auto** value (e.g. "auto 28") and a per-row **↺ revert**. One **Save** button for the whole column (batch).

**Behavior decisions (baked in):**
1. Each input prefills with the student's **current effective score** = override.score if present, else the auto raw score (online submission's earned), else blank (manual, ungraded).
2. **Save** writes only CHANGED rows. Create/update an override **only when the entered value ≠ the auto value** (avoids re-creating redundant overrides — this is what caused Mamoun's stale 311% override).
3. **↺ revert** = DELETE that student's grade_override for this assessment → cell falls back to the auto-grade. (New action `deleteGradeOverride({studentId, assessmentId, classId})`, owner/admin-guarded, then `refresh()`.) This is the missing "undo" follow-up — fold it into this build.
4. Score is RAW out of `total_points` (unchanged M3 semantics → %). Manual items have no auto, so blank until entered.
5. Batch entry: consider `setGradeOverrides([...])` (one action, many rows) or loop `setGradeOverride`; either is fine — keep pending/disabled state on Save (no frozen screen).
6. **Perf:** parallelize `getSectionGrades`'s ~5 sequential cloud queries with `Promise.all` as part of this task (the grades page is the slow one).

Data already available from `getSectionGrades`: per-assessment `totalPoints`, per-student `cells` (%) + `rawOverrides` (raw). Add the per-student **auto raw** value (submission.earned) to the payload so the editor can show "auto N" and decide ≠-auto.

## How we work on this project (for whoever resumes)
Cadence the user likes: design/brainstorm → build (subagent-driven where it fits) → verify (npm test + the e2e/ smoke harness) → milestone report → user reviews. Work autonomously between milestones; he checks results, not every step. Give honest recommendations on design choices, not just options. Keep THIS file current — it is the continuity mechanism across /clear and /compact. Be precise about built-vs-designed. Follow AGENTS.md rules.
