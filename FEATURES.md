# Telos LMS — Feature Checklist & Tracker

_A living list of every feature, used for two things: **auditing** (walk the app and tick off what works) and **tracking** (mark new features as planned → built → verified). Snapshot: 2026-07-01._

## How to use this list
- `- [ ]` = built, **not yet audited** — test it in the app, then tick it.
- `- [x]` = built **and verified working**.
- `🔲 PLANNED` = a future feature, **not built yet** (can't be ticked until built).
- `⚠️ ISSUE: …` = an audit found a problem — note it inline and leave the box unticked.
- **Auditing:** go page by page in the live app and tick each box you confirm works.
- **Tracking a new feature:** add a line as `- [ ] 🔲 PLANNED — <feature>`; when you build it, drop the `🔲 PLANNED` tag (now it's awaiting audit); tick it once verified.

## Status right now
**Everything below is BUILT & SHIPPED to production** (cloud DB at migration 0021). All boxes are **unticked = pending your audit**. There are **no planned-but-unbuilt features** at the moment — the 🔲 PLANNED section at the bottom is empty, ready for your next ideas.

**Roles:** **Student** → `/student` · **Instructor** → `/instructor` · **Admin** = instructor **+** the Admin Controls page. 🛡️ marks admin-only features. 🔎 marks a list with search/filter.

---

## 📋 Capabilities at a glance (the short version, for showing people)
- **Courses & Classes** — build courses, sections, periods, PICs; weighted grading per class.
- **Enrollment & Roster** — self-registration via expiring links, instructor approval, in-app invites, removal requests.
- **Assessments & Quizzing** — import or hand-make assessments; timed online quizzes with live countdown, autosave, and auto-submit; server-only answer keys.
- **Grading & Gradebook** — auto-grading, FEU grade sheet (Midterm/Final/Course mark + letter), editable override grid, CSV export.
- **Student Experience** — dashboard (To-Do/Done), classes, grades, answer review.
- **Accounts & Admin** — roles/status, structured names, user management, instructor-approved password resets, password-visibility helpers.
- **Security & Integrity** — server-side keys, tenant isolation, single-submission, status gating.

---

# 🧑‍🏫 Instructor & Admin

## Dashboard (`/instructor`)
- [ ] Shows a count of your classes + "Manage classes" link
- [ ] Shows a count of pending registrations (gold when any) + "Review enrollment" link
- [ ] Quick-access cards to Assessments and Grades

## Course Builder (`/instructor/builder`)
- [ ] Create a course (code, title, description) with success confirmation
- [ ] Create a class/section (course, period, section label, PIC with autocomplete)
- [ ] Success/error messages on create

## Courses & Classes (`/instructor/classes`)
- [ ] List your courses (code, title, # of sections)
- [ ] 🔎 Search courses by code/title
- [ ] Drill into a course to list its sections (name, period, PIC)
- [ ] 🔎 Search sections within a course
- [ ] Click a section to open its detail; back-navigation works

## Class Detail (`/instructor/classes/[classId]`)
- [ ] Header shows section, course title, period, PIC, section label + Grade Sheet shortcut
- [ ] Contents lists every assigned assessment with its type
- [ ] Toggle assessment **Active** on/off
- [ ] Toggle **Reveal Answers** (with the quiz/exam "after Closes" warning)
- [ ] Set assessment **period** (Midterm/Final)
- [ ] Set **Opens / Closes / Due** date-times
- [ ] Set per-attempt **time limit** (or blank)
- [ ] Assessment-setting changes **auto-save** ("Saved")
- [ ] Student roster table (name, student #, email, status)
- [ ] 🔎 Search roster by name/student #/email/status
- [ ] **Request removal** of a student (reason) → shows "Removal pending"
- [ ] **Invite an existing student** (search by name/email/student #)
- [ ] **Grade Weights** editor (Quiz/Paper/Exam %, must total 100) saves
- [ ] **Class Settings** (period + section label) saves

## Enrollment (`/instructor/enrollment`)
- [ ] Generate a **class-join link** (7-day) for a chosen section
- [ ] Generate a **general invite link** (2-day)
- [ ] Warns if an active link of that kind already exists
- [ ] Active-links list with **live countdown** to expiry
- [ ] Copy a link's URL (auto-selects)
- [ ] **Revoke** a link
- [ ] Pending Registrations list (name, student #, email, section, reason)
- [ ] Split into "Needs a section" / "Joined a section"
- [ ] 🔎 Search pending by name/student #/email/section
- [ ] Pick a section for unplaced students before approving
- [ ] **Approve** a pending student
- [ ] **Reject** a pending student

## Assessments (`/instructor/assessments`)
- [ ] "My Assessments" list (title + type tag), click to preview
- [ ] 🔎 Search assessments by name/type
- [ ] **Import** an assessment from pasted JSON (confirms ID / shows error)
- [ ] **Create a manual (offline) assessment** (name, type, total points, graded toggle for HW/Activity)
- [ ] **Assign** an assessment to a class (class, assessment, period, Opens/Closes, time limit)
- [ ] Assign disabled until class + assessment chosen

## Assessment Preview & Settings (`/instructor/assessments/[assessmentId]`)
- [ ] Read-only answer-key preview (questions, points, bonus; correct MCQ option + numeric answer marked)
- [ ] Edit **Name**
- [ ] Edit **Type** (with weight-category warning)
- [ ] **Counts toward grade** checkbox (HW/Activity only; Quiz/Exam locked graded)
- [ ] Edit **default time limit** (blank = untimed; disabled for manual)
- [ ] Save with validation + status message

## Grades / Gradebook (`/instructor/grades`)
- [ ] Section picker loads a section's gradebook
- [ ] **Grade Sheet (read-only)** — students × assessments grouped Midterm/Final/Course
- [ ] Cells show color-coded %; hand-edited cells amber + dot + tooltip
- [ ] Computed Midterm/Final/Course Mark + Letter (+ quality points)
- [ ] Weights/type-tag/amber legend shown
- [ ] 🔎 Search grade-sheet students by name/student #
- [ ] **Export CSV** of the section
- [ ] Empty states (no students / no assessments)
- [ ] **Grade Editor grid** — every cell an editable raw-score input (Tab moves)
- [ ] Live recalculation of %/MG/FG/Mark/Letter as you type
- [ ] Cell states: blue = unsaved, amber = saved override; tooltip shows auto-grade
- [ ] Per-cell **↺ revert** (to auto) and **✕ clear** (manual-only)
- [ ] 🔎 Search editor students (hidden rows keep pending edits)
- [ ] **Save changes (N)** with number validation + erase-confirm
- [ ] **Discard** unsaved edits; reload after save

## 🛡️ Admin Controls (`/instructor/admin`) — Admin only
- [ ] Non-admins see "Forbidden — Admin role required"
- [ ] Three tabs: Users / Removal requests / Password resets
- **Users tab**
  - [ ] List all users (name, email, role, status, student #) + live count
  - [ ] 🔎 Search by name/email/student #/role/status
  - [ ] **Create user** (name, email, role, status, student #, password)
  - [ ] **Edit user** (incl. optional new password)
  - [ ] **Reset PW** (≥6 chars; also re-activates a pending account)
  - [ ] **Delete user** (with confirmation)
  - [ ] Action buttons stay pinned right; action confirmations
- **Removal requests tab**
  - [ ] List pending removal requests (student, class, reason, requester)
  - [ ] **Approve** (removes from class, with confirm) / **Reject**
- **Password resets tab**
  - [ ] List pending student reset requests (name, student #, email)
  - [ ] **Approve** → sets chosen password + activates account / **Reject**

## Profile (`/instructor/profile`)
- [ ] Account card (email, role) read-only
- [ ] **Sign out**
- [ ] **Change password** link
- [ ] **Edit Name** (prefix, first*, MI, last*, suffix, student #) with live full-name preview + Save

---

# 🎓 Student

## Dashboard (`/student`)
- [ ] **To-Do / Done** tabs with live counts (To-Do by deadline, Done by recency)
- [ ] 🔎 Search tasks by title/class/type
- [ ] Task rows: type badge, title, class, practice tag, deadline/status
- [ ] Status pill: % score / Submitted / Graded offline / To do
- [ ] Action button adapts (Start/Take, Review/View result, Not yet available, Closed — missed)
- [ ] **Class invites** panel: Accept / Decline pending invitations

## Classes (`/student/classes`)
- [ ] Card per enrolled class (code, section, title, period, task counts)
- [ ] 🔎 Search classes by code/title/section/period
- [ ] Tap a class → its detail

## Class Detail (`/student/classes/[classId]`)
- [ ] Header (code, section, title, period) + back link
- [ ] "To do in this class" quick box (open, unsubmitted tasks)
- [ ] All tasks grouped Quizzes/Homework/Activities/Exams with badges/status/actions

## Grades (`/student/grades`)
- [ ] Read-only card per class with weight breakdown
- [ ] Midterm/Final assessment tiles (type tag, title, color-coded %); overrides highlighted
- [ ] Period Marks + Course Mark % + Letter + quality points
- [ ] 🔎 Search to a specific class

## Take an Assessment (`/student/take/[assignmentId]`)
- [ ] Header + instructions; auto-redirect to results if already graded; open/close gating
- [ ] **Pre-quiz "Before you start"** screen for timed assessments (rules + Start)
- [ ] **Live countdown** (sticky), red in the final minute, **auto-submits at zero**
- [ ] **Resume** prior answers (server draft, cross-device; local fallback)
- [ ] **Autosave** answers as you type/select
- [ ] MCQ (selectable options) and numeric (validated) questions; points + bonus shown
- [ ] **Submit** with pending state, single-submit protection, retry-able error → results

## Result & Answer Review (`/student/results/[submissionId]`)
- [ ] Header + title/type, overall % score, earned/possible, status
- [ ] **Answer Review** (only when revealed): each item correct/incorrect, correct answer shown for misses, bonus labeled
- [ ] Back-to-dashboard link

## Profile (`/student/profile`)
- [ ] Account card (email, role) + Sign out + Change password
- [ ] **Edit Name** form with live full-name preview + Save

---

# 🔐 Authentication & Account (shared)

## Sign In (`/login`)
- [ ] Email + password sign-in; routes to the right home by role
- [ ] **Show/Hide** toggle on the password
- [ ] "Invalid email or password" on failure
- [ ] **Request a password reset** panel (email + student # + new password + masked confirm) → instructor approves; auto-opens after a failed sign-in
- [ ] **Forgot password?** email-link flow (neutral confirmation)

## Student Registration (`/register/[token]`)
- [ ] Invalid/expired link shows the right message
- [ ] Full form (prefix, first*, MI, last*, suffix, student #*, email*, password*, confirm*)
- [ ] **Show/Hide** on password; masked confirm; match + 6-char checks
- [ ] Section dropdown for general links; optional "Reason for joining"
- [ ] Inline field hints; submit → "registration submitted, instructor will approve"

## Reset Password — email link (`/reset-password`)
- [ ] Verifies the emailed link; invalid/expired → error + back link
- [ ] Valid → Set New Password (match + 6-char) → "Password updated" → Sign in

## Change Password (`/account/password`)
- [ ] Signed-in users set a new password (match + 6-char) → success/error

## Account Pending / Holding (`/holding`)
- [ ] Shown to not-yet-active accounts; explains activation; **Sign out**

---

# ⚙️ Under the hood (system guarantees to spot-check)
- [ ] Answer keys never reach the browser (only questions served on the take page)
- [ ] Auto-grading is correct (numeric + MCQ, bonus handling, weighted marks)
- [ ] Tenant isolation — an instructor only sees their own courses/classes/students/grades
- [ ] Single-submission integrity (can't submit twice)
- [ ] Status gating — pending/suspended accounts can't reach protected pages
- [ ] `student_number` is unique (duplicate registration blocked)

---

# 🔲 Planned / Not yet implemented
_None right now — every feature above is built and shipped. Add future ideas here as `- [ ] 🔲 PLANNED — <feature>`, then promote them up into the relevant section once built._
