# Grade Editor — grid redesign (read-only Grade Sheet + editable Grade Editor)

**Date:** 2026-06-28
**Status:** Design approved (pending written-spec review)
**Supersedes:** the per-assessment "Option 1" editor shipped on `feat/grade-editor`
(2026-06-28). That version (dropdown + one-assessment column) is replaced by the
two-grid layout below, based on the user trying it live.

## Why

After using the per-assessment editor, the user wants the editor to look like the
gradebook itself (a grid), not a dropdown that edits one assessment at a time. They
also hit a real sharp edge: the per-row "↺ revert" silently and permanently deleted a
**manual** assessment's only score (no auto-grade to fall back to). This redesign fixes
both: a full editable grid, and revert/clear that is safe for manual items.

## Terms (the two sections, stacked)

- **Grade Sheet** (top) — where you *view* grades. Read-only. The official, **saved**
  FEU report.
- **Grade Editor** (bottom) — where you *enter* grades. A full editable grid that
  **mirrors the Grade Sheet's columns exactly**, with the assessment cells editable and
  a **live preview** of the computed marks for the working draft.

## Grade Sheet (top, read-only)

- Card heading: **"Grade Sheet"** (new explicit label) + the section display name
  (e.g. `AMS0011 - 5`) and student count.
- Columns (unchanged structure): Name · Student # · [midterm assessment cols] · **MG** ·
  [final assessment cols] · **FG** · **Course Mark** · **LG**.
- **Assessment cell** shows the percentage **with a `%` sign** (e.g. `93.3%`), colored by
  score (see Coloring). `—` when there is no score.
- **MG / FG / Course Mark** now render **with a `%` sign** (e.g. `91.00%`); they are
  percentages. **LG** stays `letter (qp)`.
- **Manual-changed cells** carry the amber "manual" treatment (see Coloring) so the
  instructor can see at a glance which grades were hand-entered vs auto-graded — on the
  Grade Sheet too, not just the editor.
- Fully read-only. The previous click-to-edit cells and clickable column-header
  selection are removed (the editor is now a full grid, so there is nothing to "select").

## Grade Editor (bottom, editable)

- Card heading: **"Grade Editor"**.
- **Identical columns to the Grade Sheet**: Name · Student # · [midterm cols] · MG ·
  [final cols] · FG · Course Mark · LG.
- **Assessment cells are click-to-edit:**
  - Display mode shows `raw / total` (e.g. `28 / 30`), colored by score; `— / total` when
    blank (manual, ungraded).
  - Click → the cell becomes a numeric input for the **raw** score with a `/ total` hint,
    **prefilled with the current effective score** (override → else auto raw → else blank).
  - `Enter`/blur **stages** the edit (does not save yet); `Esc` cancels the cell.
- **MG / FG / Course Mark / LG recompute LIVE** from the staged edits using the shared
  gradebook math, so the editor previews the projected marks for what you have typed
  **before** saving. (The top Grade Sheet keeps showing the *saved* numbers until Save;
  after Save the two match.)
- **Edited-but-unsaved** cells get a blue outline (distinct from the amber "saved manual"
  look). A small **"Discard"** link resets all staged edits back to the saved values.
- **Save changes (N edited)** button commits all staged edits in one batch, across all
  assessments. Disabled when nothing is edited or while saving (shows "Saving…"); no
  frozen screen. On success the server `refresh()` re-renders both grids.

## Revert / Clear (the safety fix)

While editing a cell that currently has an override, a small action appears under the
input:

- **Online item** (an auto-grade exists) → `↺ revert to auto (N)`. One step, safe — it
  stages the auto value, which on Save deletes the override (the `≠-auto` rule) and the
  cell falls back to the auto-grade. **No confirmation** needed (nothing is lost).
- **Manual item** (no auto-grade) → `Clear grade` (red). Stages a blank.

**Confirmation on Save:** if any staged change would erase a **manual-only** score
(a manual item being cleared / blanked when it had an override), Save shows **one**
confirm dialog summarizing the count: *"This removes N hand-entered score(s) with no
auto-grade to fall back to — continue?"* Online reverts and ordinary edits never prompt.

## Coloring (both grids)

- **Score color** (the number): `≥75` green, `50–74` gold-dark, `<50` red. Same
  `scoreColor` thresholds used today.
- **Manual override marker:** an amber cell tint (`#fffbe6`) + a small amber dot (`•`)
  before the value, on **both** grids. Hover title: `Manually entered (auto: N%)` for
  online items, or `Manually entered (no auto-grade)` for manual items.
- **Unsaved edit (editor only):** blue outline + light-blue tint, which visually
  supersedes the amber until the edit is saved or discarded.
- **Letter-grade color** (`letterColor`) unchanged.

These helpers (`scoreColor`, `letterColor`, `typeTag`/`typeBg`, the manual-marker style)
are shared by both grids — extracted into a small module (`app/instructor/grades/
gradeStyles.ts` or `lib/gradeStyles.ts`) to avoid duplication.

## Data & shared computation

- **`getSectionGrades` already returns everything needed** per student/assessment:
  `cells` (%), `rawOverrides` (raw), `autoRaw` (raw), and per-assessment `totalPoints`,
  `type`, `period`. No new query work; it was parallelized in the prior task.
- **Single source of truth for the marks math.** The per-student compute currently lives
  inline in `getSectionGrades` (group cells by period+category → `categoryAverage` →
  `periodMark` → `courseMark` → `gradeFor`). Extract it into a **pure function** —
  `computeStudentMarks(cellsByAssessment, assessments, weights)` in `lib/gradebook.ts`
  (or `lib/sectionGrades.ts`) — and call it from **both** the server (`getSectionGrades`)
  and the client (editor live preview). This guarantees the preview can never drift from
  the saved computation.
- **Batch action generalized to multiple assessments.** Today `setGradeOverrides` takes a
  single top-level `assessmentId`. Change it to:
  `setGradeOverrides({ classId, entries: [{ studentId, assessmentId, score: number | null }] })`.
  Owner/admin-guard once; partition into upserts (`score != null`) and deletes
  (`score === null`); bulk-upsert the upserts (rows already carry `assessment_id`); for
  deletes, group by `assessmentId` and issue one `.in('student_id', ids)` delete per
  assessment; one `refresh()`. `score: null` still means revert-to-auto / clear.
- `deleteGradeOverride` stays as-is (owner-guarded single delete); the editor now routes
  reverts/clears through the batch Save, so this action is retained for completeness/tests
  but no longer called by the grades UI.

## Components / files

- `app/instructor/grades/GradeSheet.tsx` — read-only grid; add "Grade Sheet" heading,
  `%` signs, amber manual marker; **remove** click-to-edit and column-header selection
  (and the `selectedAssessmentId`/`onSelectAssessment` props).
- `app/instructor/grades/GradeEditor.tsx` — rewritten as the full editable grid (mirrors
  the sheet) with staged edits, live preview via `computeStudentMarks`, batch Save,
  revert/clear + confirm. The dropdown + `ColumnEditor` are removed.
- `app/instructor/grades/GradesView.tsx` — **removed.** There is no longer shared
  selection state, so `page.tsx` renders `<GradeSheet>` then `<GradeEditor>` directly
  (both client components, both fed the same `grades` prop).
- `app/instructor/grades/page.tsx` — render the two components; keep the existing
  subtitle/section picker.
- shared styles module — new (`gradeStyles.ts`) for the color/marker helpers.
- `lib/gradebook.ts` (or new `lib/sectionGrades.ts`) — add `computeStudentMarks`.
- `app/actions/setGradeOverrides.ts` — generalized signature (see above).

## Testing

- **Unit — `setGradeOverrides` (generalized):** upsert + delete spanning **two**
  assessments in one call; owner-guard rejection; empty no-op; bonus `>100` unclamped.
  Update the existing `tests/grade-overrides-editor.test.ts` to the new per-entry
  `assessmentId` shape.
- **Unit — `computeStudentMarks`:** given cells, assert MG/FG/Course Mark/LG equal the
  `lib/gradebook` reference (and that `getSectionGrades` still produces identical numbers
  after the extraction — existing `tests/section-grades.test.ts` guards this).
- **e2e smoke:** `/instructor/grades` (+ `?classId=`) still load both grids with no
  errors/loops/stuck-loading.
- **Interaction (Playwright, local):** edit a cell → editor MG updates live before save →
  Save → top Grade Sheet shows the new %, with amber tint on the changed cell; online
  `↺ revert to auto` falls back to the auto-grade; clearing a **manual** graded cell
  triggers the confirm and (on confirm) blanks it.

## Out of scope (YAGNI)

- Per-cell auto-save (we batch on Save only).
- CSV export / weighted-export (separate backlog item).
- Editing class weights here (stays on the class detail page).
- An undo/toast beyond the Save-time confirm for destructive manual clears.
