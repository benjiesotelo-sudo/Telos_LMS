# Telos_LMS — Slice 2 Roadmap & Agenda (2026-06-26)

Captured agenda for the day's build. Source: brainstorming session 2026-06-26.
Each Theme gets its own detailed design spec + plan before implementation.

## Mental model (the spine)
**Class** → has a **Roster** → and a set of **Assessments** → each **Assigned** to the class
→ which students **Take** → and the instructor **Grades/Reviews**.

The **Class is the home object.** Instructor and student dashboards are the *same screen
shape* over classes, differing only by permission. Every screen should answer "where am I
in that chain."

## Build order (committed)
**B (classes + roster) → A (profiles/roles) → C (instructor authoring + dashboard)
→ D (student experience) →** E hardening woven in as each path is touched.

Rationale: Slice 1 already proved the end-to-end loop (import→assign→take→grade in the
live pilot). What's missing is *real classes* — today there is one hardcoded course
(`app/instructor/page.tsx` grabs first course + first period). Classes are the spine both
dashboards render over, so foundation-first is highest-leverage.

---

## Theme A — Identity & Profile *(both roles, foundational)*
- **A1** Profile view page + logout — instructor & student. (asks 1.5, 2.2)
- **A2** Student requests detail changes → lecturer/superadmin approves. Students cannot
  self-edit beyond what the privilege-escalation guard allows today. (ask 2.2)
- **A3** Promote own account to **super admin**. Same powers as instructor for now; the
  role is the seam for future privileges. Must respect the escalation guard. (ask 1.6)

## Theme B — Class / Course Building *(foundational spine — START HERE)*
- **B1** Create classes with **course code + course title/description**. Replaces today's
  single hardcoded course; enables multi-course. (ask 1.x)
- **B2** Period / PIC / class-name metadata captured per class. (ask 1.3)
- **B3** **Batch enrollment** via shareable invite link where the **student fills their own
  details** (all fields). Inverts today's flow (instructor types each name). Includes the
  duplicate-invite guard. Security-sensitive — touches escalation guard. (ask 1.4)

## Theme C — Assessment Authoring & Management *(instructor)*
- **C1** **Instructor dashboard**: list assessments grouped by type (homework/quiz/exam),
  active vs. draft. (ask 1.1)
- **C2** Manage / change a quiz's settings after creation. (ask 1.1)
- **C3** **Quiz preview** + **view correct answers** on the instructor side. Needs a server
  action — answer keys are service-role-only and must stay off the student client. (ask 1.1)
- **C4** Quiz authoring details: **quiz name + description**, plus retained header
  (class, code, period, PIC, type, student #). (asks 1.x, 1.3)
- **C5** **Timer setting** on a quiz: duration-after-start. (ask 1.2, author side)
- **C6** **Fast assign** to a whole class — everyone enrolled sees what they must take. (ask 1.x)

## Theme D — Student Experience *(taking)*
- **D1** **Student dashboard**. (ask 2.1)
- **D2** **View my classes**. (ask 2.3)
- **D3** **View class details** — assessment list, deadlines, timer info. (ask 2.4)
- **D4** **Pre-quiz screen**: see timer + deadline *before* starting. (ask 2.5)
- **D5** **Live timer** while taking: countdown + auto-submit on timeout. (ask 1.2, student side)

## Theme E — Hardening *(cross-cutting, from prior Slice 2 backlog)*
- Server-side auto-save + cross-device resume (today: client localStorage only)
- Status enforcement on the data path
- Transactional `importAssessment`
- BEFORE-UPDATE role trigger on `profiles`
- `middleware` → `proxy` rename (Next 15 deprecation)
- N+1 student-dashboard query
- Saved Supabase SQL-Editor admin queries: `List Users`, `Clean Test Data`, `Health Check`, `1st Setup`

---

## Status
- [ ] Theme B — design spec → plan → build  ← **current**
- [ ] Theme A
- [ ] Theme C
- [ ] Theme D
- [ ] Theme E (woven in)
