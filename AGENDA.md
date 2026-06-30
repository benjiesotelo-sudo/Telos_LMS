# Telos_LMS — Agenda & Status

_Snapshot: 2026-06-30 · Live app: https://telos-lms.vercel.app · Cloud DB at migration **0020**_

**Legend:** ✅ done & shipped · 🟡 built & verified, NOT yet deployed · 🔲 to do · 👤 your hands (dashboard/decision)

---

## Where we are in one breath
The product is **feature-complete and live**. As of 2026-06-30 the password/login fixes **and** the 2026-06-29 UI polish are **shipped to production** (cloud at 0020, code deployed, health-checked). What's left is **a handful of Supabase dashboard chores, light housekeeping, and a prod spot-check** — no remaining feature building.

---

## ✅ Accomplished (shipped to production)

### The product, end to end
- ✅ **Slice 1** — import assessment → assign to class → enroll student → student takes it → server-only auto-grading → both see the score. Email/password auth, RLS tenant isolation, single-submission integrity.
- ✅ **Theme B — Classes & Roster** — reusable Courses → Classes/sections; enroll links (class/general, live countdown); student self-registration → instructor approval.
- ✅ **Theme A — Identity** — structured names; profile view/edit; change-password; super-admin user management (CRUD + reset).
- ✅ **Theme C — Course hub + FEU gradebook** — Courses & Classes hub; class detail (contents, students, weights); per-assignment period/active/reveal toggles + deadlines; FEU grade sheet by section; manual score override (raw / total → %); instructor preview + view-answers (key stays server-side).
- ✅ **Theme D — Student experience** — Dashboard (To-Do / Done), Classes, Grades, class detail, pre-quiz screen.
- ✅ **Quiz timer** — default per assessment, adjustable per section, live countdown + auto-submit, cross-refresh resume.
- ✅ **Invites + removals** — invite existing students (in-app accept/decline); removal requests → admin approval.
- ✅ **Grade editor** — two-grid layout (read-only FEU sheet + live editable grid), safe revert, batch save.
- ✅ **Taxonomy + graded toggle** — 4 types (Quiz/Homework/Activity/Exam); practice (ungraded) items shown but excluded from marks.
- ✅ **Gradebook CSV export.**
- ✅ **Hardening** — server-side autosave + cross-device resume; status enforcement; transactional import RPC; BEFORE-UPDATE role/status guard trigger; anti-enumeration; e2e smoke (16/16).
- ✅ **Cloud migrated to 0019**, code deployed (commit `8d081f2`), production health-checked.

### This session — 2026-06-30 · Password & login ✅ _(SHIPPED to production)_
- ✅ **Admin "Reset PW" fixed** — now re-activates a `pending` account, so a reset actually lets the student back in (root cause: the password changed but the route gate kept parking pending users at `/holding`).
- ✅ **Show/hide password toggle** on login + registration.
- ✅ **Confirm-password field on registration** — second box always masked, with live mismatch warning.
- ✅ **Student request-reset flow** (email-free, instructor-approved) — locked-out student picks a new password → lands in **Admin Controls → Password resets** → you Approve/Reject. Migration `0020`.
- **Verification:** 302/302 tests · build clean · typecheck clean · 16-agent adversarial review → 4 real findings fixed · cloud 0020 + prod health-checked (new reset panel confirmed live).

---

## 🔲 Remaining

### 1. Ship to production ✅ _(done 2026-06-30)_
- ✅ Committed (feature `b43a03f` · UI fixes `f2d3de9` · docs `fdc49c8`) — today's password-reset work + the 2026-06-29 UI fixes shipped together.
- ✅ Deployed in order: `supabase db push` (cloud 0019 → **0020**, verified) → `git push origin main` (Vercel) → prod health-checked, new reset panel live on `/login`.
- 🔲 _Remaining: the prod spot-check on real data (see §5)._

### 2. Supabase ops 👤 _(dashboard / SQL Editor — Claude can prep ready-to-paste SQL)_
- 🔲 Schedule `purge_expired_pending()` via **pg_cron** (auto-cleans stale >7-day pending signups).
- 🔲 **Unique index on `profiles.student_number`** _(could be migration 0021 — needs a duplicate-check first, or it fails on existing dupes)._
- 🔲 Keep public signups OFF / ensure `handle_new_user` forces `role=student` (no self-promotion on cloud signup).
- 🔲 Save admin SQL snippets in the dashboard: **List Users · Clean Test Data · Health Check · 1st Setup**.

### 3. Housekeeping
- ✅ Deleted merged branches `feat/theme-d-student` + `polish/student-ux-feu-theme` (2026-06-30).
- 🔲 Test-data cleanup (SMOKE accounts / SMOKE101 / "Homework Smoke") — **on hold until you say so**; scoped-safe SQL is ready.

### 4. Decisions 👤 _(yours — not a build)_
- 🔲 **Telos_AMS0011** — whether it graduates to its own repo.
- 🔲 Keep the old email-based "Forgot password?" link, or drop it now that the instructor-approved reset exists? _(Currently both are on the login page.)_

### 5. Verify on production 🔲
- 🔲 After shipping: spot-check on real data — today's reset flow **and** the 2026-06-29 Theme D deploy you hadn't eyeballed yet (instructor + a student account).

---

## Not remaining (the reassuring part)
- **All planned features are built** (Themes A–D, gradebook, timer, invites/removals, CSV).
- **All planned hardening is built.**
- No outstanding build work — only ship + ops + housekeeping above.

---

### How to deploy (proven pattern)
`supabase db push --linked --yes` (migrate cloud FIRST) → `git push origin main` (Vercel auto-deploys). Migrations are additive; always migrate before pushing code.
