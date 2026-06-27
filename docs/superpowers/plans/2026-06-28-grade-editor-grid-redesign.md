# Grade Editor — Grid Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-assessment grade editor with a two-grid layout — a read-only **Grade Sheet** (percentages, `%` signs, amber marker on hand-edited grades) above an editable **Grade Editor** grid that mirrors it, with a live mark preview, batch save, and manual-safe revert/clear.

**Architecture:** Extract the per-student marks math into one pure function shared by the server (`getSectionGrades`) and the client editor (live preview), so the preview can never drift from saved numbers. Generalize the batch save to span multiple assessments. Both grids share color/marker style helpers; the editor stages edits client-side and commits them in one batch on Save.

**Tech Stack:** Next.js (this repo's vendored build), React client components, TypeScript, Supabase (`createAdminClient`), Vitest against the local Supabase stack, Playwright for smoke + interaction.

## Global Constraints

- **No frozen screens** (AGENTS.md): the Save button disables + shows "Saving…"; mutations rely on the server action's `refresh()` from `next/cache`.
- **`'use server'` files export only async actions** (AGENTS.md): shared constants/types/helpers go in plain `lib/*` or non-`'use server'` modules.
- **`createClient()` is async — always `await`** it; the test-auth seam returns a per-user anon client under VITEST.
- **Tests run against the LOCAL Supabase stack only** (`supabase start` / `supabase db reset`); `npm test` resets the DB first.
- **Score is RAW out of `total_points`**; `cell% = raw / total_points * 100`; bonus may exceed 100 and is never clamped. An override is created only when the entered value ≠ the auto value.
- **Owner/admin guard** on every grade mutation (caller owns the class or has `role='admin'`).

---

### Task 1: Extract `computeStudentMarks` (shared marks math)

**Files:**
- Modify: `lib/gradebook.ts` (add `computeStudentMarks` + `StudentMarks`)
- Modify: `app/actions/getSectionGrades.ts:137-226` (use the shared function)
- Test: `tests/gradebook.test.ts` (add cases), `tests/section-grades.test.ts` (must stay green)

**Interfaces:**
- Produces:
  ```ts
  export interface StudentMarks {
    midtermMark: number | null
    finalMark: number | null
    courseMark: number | null
    letter: string | null
    qp: number | null
  }
  export interface MarkAssessment {
    assessmentId: string
    type: 'activity' | 'quiz' | 'exam'
    period: 'midterm' | 'final'
  }
  export function computeStudentMarks(
    cells: Record<string, number | null>,           // assessmentId -> cell % (null = no score)
    assessments: MarkAssessment[],
    weights: { wtQuiz: number; wtPaper: number; wtExam: number },
  ): StudentMarks
  ```
- Consumes: existing `categoryAverage`, `periodMark`, `courseMark`, `gradeFor` in `lib/gradebook.ts`.

- [ ] **Step 1: Write the failing test** in `tests/gradebook.test.ts`

```ts
import { computeStudentMarks } from '@/lib/gradebook'

describe('computeStudentMarks', () => {
  const weights = { wtQuiz: 0.3, wtPaper: 0.2, wtExam: 0.5 }
  const assessments = [
    { assessmentId: 'q', type: 'quiz' as const, period: 'midterm' as const },
    { assessmentId: 'p', type: 'activity' as const, period: 'midterm' as const },
    { assessmentId: 'e', type: 'exam' as const, period: 'midterm' as const },
  ]

  it('computes midterm/course mark + letter from cells (quizzes 80, papers 75, exam 90)', () => {
    const m = computeStudentMarks({ q: 80, p: 75, e: 90 }, assessments, weights)
    expect(m.midtermMark).toBe(84)   // 80*.3 + 75*.2 + 90*.5
    expect(m.finalMark).toBeNull()   // no final assessments
    expect(m.courseMark).toBe(84)    // one-period pass-through
    expect(m.letter).toBe('B')
    expect(m.qp).toBe(3.0)
  })

  it('all-null cells → null marks and no letter', () => {
    const m = computeStudentMarks({ q: null, p: null, e: null }, assessments, weights)
    expect(m.midtermMark).toBeNull()
    expect(m.courseMark).toBeNull()
    expect(m.letter).toBeNull()
    expect(m.qp).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/gradebook.test.ts -t computeStudentMarks`
Expected: FAIL — `computeStudentMarks is not a function`.

- [ ] **Step 3: Implement `computeStudentMarks`** in `lib/gradebook.ts` (append near the bottom, after `gradeFor`)

```ts
export interface StudentMarks {
  midtermMark: number | null
  finalMark: number | null
  courseMark: number | null
  letter: string | null
  qp: number | null
}

export interface MarkAssessment {
  assessmentId: string
  type: 'activity' | 'quiz' | 'exam'
  period: 'midterm' | 'final'
}

/**
 * Pure per-student mark computation, shared by getSectionGrades (server) and the
 * Grade Editor live preview (client). `cells` maps assessmentId → cell percentage
 * (null = no score). Groups non-null cells by period + category, then applies the
 * FEU period/course/letter math from this module.
 */
export function computeStudentMarks(
  cells: Record<string, number | null>,
  assessments: MarkAssessment[],
  weights: { wtQuiz: number; wtPaper: number; wtExam: number },
): StudentMarks {
  const groups: Record<'midterm' | 'final', { quizzes: number[]; papers: number[]; exam: number[] }> = {
    midterm: { quizzes: [], papers: [], exam: [] },
    final:   { quizzes: [], papers: [], exam: [] },
  }

  for (const a of assessments) {
    const val = cells[a.assessmentId]
    if (val === null || val === undefined) continue
    const g = groups[a.period]
    if      (a.type === 'quiz')     g.quizzes.push(val)
    else if (a.type === 'activity') g.papers.push(val)
    else if (a.type === 'exam')     g.exam.push(val)
  }

  const midtermMark = periodMark(
    { quizzes: categoryAverage(groups.midterm.quizzes), papers: categoryAverage(groups.midterm.papers), exam: categoryAverage(groups.midterm.exam) },
    weights,
  )
  const finalMark = periodMark(
    { quizzes: categoryAverage(groups.final.quizzes), papers: categoryAverage(groups.final.papers), exam: categoryAverage(groups.final.exam) },
    weights,
  )
  const cm = courseMark(midtermMark, finalMark)
  const grade = gradeFor(cm)

  return {
    midtermMark,
    finalMark,
    courseMark: cm,
    letter: grade?.letter ?? null,
    qp: grade?.qp ?? null,
  }
}
```

- [ ] **Step 4: Refactor `getSectionGrades` to use it.** In `app/actions/getSectionGrades.ts`, replace the inline grouping + period/course/letter block (the part after `cells`/`rawOverrides`/`autoRaw` are built, from `// --- group non-null cells by period + category ---` through the `const grade = gradeFor(cm)` line) with:

```ts
    // --- marks (shared pure fn — single source of truth) ---
    const marks = computeStudentMarks(cells, assessmentMetas, weights)

    return {
      studentId:     stu.studentId,
      fullName:      stu.fullName,
      studentNumber: stu.studentNumber,
      cells,
      rawOverrides,
      autoRaw,
      midtermMark: marks.midtermMark,
      finalMark:   marks.finalMark,
      courseMark:  marks.courseMark,
      letter:      marks.letter,
      qp:          marks.qp,
    }
```

Add the import at the top: `import { computeStudentMarks } from '@/lib/gradebook'` (extend the existing `lib/gradebook` import list — drop `categoryAverage, periodMark, courseMark, gradeFor` if no longer referenced elsewhere in the file).

- [ ] **Step 5: Run the gradebook + section-grades tests**

Run: `npx vitest run tests/gradebook.test.ts tests/section-grades.test.ts`
Expected: PASS — section-grades numbers unchanged (proves the extraction is behavior-preserving).

- [ ] **Step 6: Commit**

```bash
git add lib/gradebook.ts app/actions/getSectionGrades.ts tests/gradebook.test.ts
git commit -m "refactor(grades): extract computeStudentMarks shared by server + client"
```

---

### Task 2: Generalize `setGradeOverrides` to multiple assessments

**Files:**
- Modify: `app/actions/setGradeOverrides.ts`
- Test: `tests/grade-overrides-editor.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface GradeOverrideEntry {
    studentId: string
    assessmentId: string
    score: number | null    // null = remove override (revert/clear)
  }
  export interface SetGradeOverridesInput { classId: string; entries: GradeOverrideEntry[] }
  export async function setGradeOverrides(input: SetGradeOverridesInput): Promise<{ ok: true; upserted: number; deleted: number }>
  ```
- Consumes: `createClient`, `createAdminClient`, `refresh` (already imported).

- [ ] **Step 1: Update the test** `tests/grade-overrides-editor.test.ts` — change every `setGradeOverrides` call from the old `{ classId, assessmentId, entries: [{studentId, score}] }` shape to per-entry `assessmentId`, and add a cross-assessment case. Replace the whole `describe('setGradeOverrides (batch column save)' ...)` block with:

```ts
describe('setGradeOverrides (batch save across assessments)', () => {
  it('upserts and reverts across two assessments in one call', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    // Seed an override on assessment2 for B so the null entry deletes something.
    await setGradeOverride({ studentId: studentBId, assessmentId: assessment2Id, classId, score: 60 })

    const res = await setGradeOverrides({
      classId,
      entries: [
        { studentId: studentAId, assessmentId,        score: 77 },   // upsert
        { studentId: studentAId, assessmentId: assessment2Id, score: 42 }, // upsert (other assessment)
        { studentId: studentBId, assessmentId: assessment2Id, score: null }, // delete
      ],
    })
    expect(res.ok).toBe(true)
    expect(res.upserted).toBe(2)
    expect(res.deleted).toBe(1)

    const a1 = await readOverride(studentAId)              // assessmentId
    expect(a1).toHaveLength(1)
    expect(Number(a1![0].score)).toBe(77)

    const a2 = await readOverrideFor(studentAId, assessment2Id)
    expect(Number(a2![0].score)).toBe(42)

    expect(await readOverrideFor(studentBId, assessment2Id)).toHaveLength(0)
  })

  it('an empty entries array is a no-op', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const res = await setGradeOverrides({ classId, entries: [] })
    expect(res).toEqual({ ok: true, upserted: 0, deleted: 0 })
  })

  it('a non-owner instructor is rejected', async () => {
    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(
      setGradeOverrides({ classId, entries: [{ studentId: studentAId, assessmentId, score: 10 }] }),
    ).rejects.toThrow()
  })

  it('a bonus score > 100 is stored unclamped', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    await setGradeOverrides({ classId, entries: [{ studentId: studentBId, assessmentId, score: 108 }] })
    const b = await readOverride(studentBId)
    expect(Number(b![0].score)).toBe(108)
  })
})
```

Add a second seeded assessment + helpers near the top of the file. In `beforeAll`, after `assessmentId = imported.assessmentId`, add a second import:

```ts
  const imported2 = await importAssessment({ ...quiz1, title: 'GE Quiz 2', slug: 'ge-quiz-2' })
  assessment2Id = imported2.assessmentId
```

Declare `let assessment2Id: string` with the other `let`s. Add helper:

```ts
async function readOverrideFor(studentId: string, aId: string) {
  const admin = (await import('@/lib/supabase/server')).createAdminClient()
  const { data, error } = await admin.from('grade_overrides').select('score')
    .eq('student_id', studentId).eq('assessment_id', aId).eq('class_id', classId)
  if (error) throw error
  return data
}
```

(If `importAssessment` rejects a duplicate slug/title, instead create the second assessment via the admin client directly — `admin.from('assessments').insert({ instructor_id: instructorId, title: 'GE Quiz 2', type: 'quiz', total_points: 1, questions: [] }).select('id').single()` — and use its id.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/grade-overrides-editor.test.ts`
Expected: FAIL — `setGradeOverrides` still expects top-level `assessmentId`.

- [ ] **Step 3: Rewrite `app/actions/setGradeOverrides.ts`**

```ts
'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface GradeOverrideEntry {
  studentId: string
  assessmentId: string
  /** Raw score (may exceed total_points for bonus), OR null to REMOVE the override
   *  for this (student, assessment) — revert-to-auto / clear. */
  score: number | null
}

export interface SetGradeOverridesInput {
  classId: string
  entries: GradeOverrideEntry[]
}

/**
 * Batch-save grade edits spanning any number of assessments in one class. One
 * owner/admin guard, one bulk upsert (score != null), and grouped deletes
 * (score === null), then a single refresh(). The editor sends only CHANGED rows.
 */
export async function setGradeOverrides(
  input: SetGradeOverridesInput,
): Promise<{ ok: true; upserted: number; deleted: number }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()

  const { data: cls, error: clsErr } = await admin
    .from('classes').select('instructor_id').eq('id', input.classId).single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  const toUpsert = input.entries.filter((e) => e.score !== null)
  const toDelete = input.entries.filter((e) => e.score === null)

  let upserted = 0
  if (toUpsert.length > 0) {
    const now = new Date().toISOString()
    const rows = toUpsert.map((e) => ({
      student_id: e.studentId,
      assessment_id: e.assessmentId,
      class_id: input.classId,
      score: e.score as number,
      note: '',
      instructor_id: callerId,
      updated_at: now,
    }))
    const { error: upErr } = await admin
      .from('grade_overrides')
      .upsert(rows, { onConflict: 'student_id,assessment_id,class_id' })
    if (upErr) throw new Error(`Failed to upsert grade overrides: ${upErr.message}`)
    upserted = rows.length
  }

  let deleted = 0
  if (toDelete.length > 0) {
    // Group deletes by assessment so each delete is one .in('student_id', ...) call.
    const byAssessment = new Map<string, string[]>()
    for (const e of toDelete) {
      const arr = byAssessment.get(e.assessmentId) ?? []
      arr.push(e.studentId)
      byAssessment.set(e.assessmentId, arr)
    }
    for (const [assessmentId, studentIds] of byAssessment) {
      const { error: delErr } = await admin
        .from('grade_overrides')
        .delete()
        .eq('class_id', input.classId)
        .eq('assessment_id', assessmentId)
        .in('student_id', studentIds)
      if (delErr) throw new Error(`Failed to delete grade overrides: ${delErr.message}`)
      deleted += studentIds.length
    }
  }

  refresh()
  return { ok: true, upserted, deleted }
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run tests/grade-overrides-editor.test.ts`
Expected: PASS (all describe blocks, incl. deleteGradeOverride which is unchanged).

- [ ] **Step 5: Commit**

```bash
git add app/actions/setGradeOverrides.ts tests/grade-overrides-editor.test.ts
git commit -m "feat(grades): batch save grade overrides across multiple assessments"
```

---

### Task 3: Shared grid style helpers

**Files:**
- Create: `app/instructor/grades/gradeStyles.ts`

**Interfaces:**
- Produces:
  ```ts
  export function scoreColor(pct: number): string
  export function letterColor(letter: string | null): string
  export function typeTag(t: string): string
  export function typeBg(t: string): string
  export function assessmentOrder(type: string): number
  export function splitPeriods<T extends { type: 'activity'|'quiz'|'exam'; period: 'midterm'|'final' }>(cols: T[]): { midtermCols: T[]; finalCols: T[] }
  export const MANUAL_TINT: string   // '#fffbe6'
  export const EDIT_OUTLINE: string  // '#2563eb'
  export const EDIT_TINT: string     // '#eff4ff'
  ```

- [ ] **Step 1: Create `app/instructor/grades/gradeStyles.ts`** (plain module — no `'use client'`, no server action)

```ts
// Shared color + layout helpers for the Grade Sheet (read-only) and Grade Editor.

export function scoreColor(pct: number): string {
  if (pct >= 75) return 'var(--green)'
  if (pct >= 50) return 'var(--gold-dk)'
  return '#c0392b'
}

export function letterColor(letter: string | null): string {
  if (!letter) return 'var(--gray)'
  if (letter === 'A') return 'var(--green)'
  if (letter.startsWith('B')) return '#2563eb'
  if (letter.startsWith('C')) return 'var(--gold-dk)'
  if (letter.startsWith('D')) return '#ea580c'
  return '#c0392b'
}

export function typeTag(t: string): string {
  return t === 'quiz' ? 'Q' : t === 'activity' ? 'P' : 'E'
}

export function typeBg(t: string): string {
  return t === 'quiz' ? '#f0f9f4' : t === 'activity' ? '#fffbeb' : '#eef2ff'
}

export function assessmentOrder(type: string): number {
  return type === 'quiz' ? 0 : type === 'activity' ? 1 : 2
}

export function splitPeriods<T extends { type: 'activity' | 'quiz' | 'exam'; period: 'midterm' | 'final' }>(
  cols: T[],
): { midtermCols: T[]; finalCols: T[] } {
  const sort = (a: T, b: T) => assessmentOrder(a.type) - assessmentOrder(b.type)
  return {
    midtermCols: cols.filter((c) => c.period === 'midterm').sort(sort),
    finalCols:   cols.filter((c) => c.period === 'final').sort(sort),
  }
}

export const MANUAL_TINT = '#fffbe6'
export const EDIT_OUTLINE = '#2563eb'
export const EDIT_TINT = '#eff4ff'
```

- [ ] **Step 2: Typecheck** (no dedicated test; it's pure helpers verified by the components that import it)

Run: `npx tsc --noEmit` (or rely on the Task 7 build).
Expected: no errors in `gradeStyles.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/instructor/grades/gradeStyles.ts
git commit -m "feat(grades): shared color/layout helpers for the two grids"
```

---

### Task 4: Read-only Grade Sheet (heading, % signs, amber marker)

**Files:**
- Rewrite: `app/instructor/grades/GradeSheet.tsx`

**Interfaces:**
- Produces: `export function GradeSheet({ grades }: { grades: SectionGrades }): JSX.Element` (drops `selectedAssessmentId` / `onSelectAssessment`).
- Consumes: `gradeStyles.ts` helpers; `SectionGrades`, `SectionAssessmentMeta` from `@/lib/types`.

- [ ] **Step 1: Rewrite `app/instructor/grades/GradeSheet.tsx`** as read-only with the heading, `%` signs, and amber manual marker.

```tsx
'use client'
import type { SectionGrades, SectionAssessmentMeta } from '@/lib/types'
import { scoreColor, letterColor, typeTag, typeBg, splitPeriods, MANUAL_TINT } from './gradeStyles'

// One read-only assessment cell. `isManual` → amber tint + dot.
function ReadCell({ pct, isManual, autoPct }: { pct: number | null; isManual: boolean; autoPct: number | null }) {
  if (pct === null) return <td style={tdStyle}><span style={{ color: 'var(--gray)' }}>—</span></td>
  const title = isManual
    ? autoPct !== null ? `Manually entered (auto: ${autoPct.toFixed(1)}%)` : 'Manually entered (no auto-grade)'
    : undefined
  return (
    <td style={{ ...tdStyle, background: isManual ? MANUAL_TINT : undefined }} title={title}>
      {isManual && <span style={{ color: 'var(--gold-dk)', marginRight: 3 }}>•</span>}
      <span style={{ color: scoreColor(pct), fontWeight: 500 }}>{pct.toFixed(1)}%</span>
    </td>
  )
}

export function GradeSheet({ grades }: { grades: SectionGrades }) {
  const { class: cls, assessments, students } = grades
  const { midtermCols, finalCols } = splitPeriods(assessments)
  const mSpan = midtermCols.length + 1
  const fSpan = finalCols.length + 1
  const { wtQuiz, wtPaper, wtExam } = cls.weights

  function colHeader(a: SectionAssessmentMeta, isFirst: boolean) {
    return (
      <th key={a.id} title={a.title}
        style={{ ...thBase, background: typeBg(a.type), maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: isFirst ? '2px solid var(--green)' : undefined }}>
        <span style={{ color: 'var(--gray)', marginRight: 2 }}>[{typeTag(a.type)}]</span>{a.title}
      </th>
    )
  }
  const markCell = (v: number | null) => v !== null ? `${v.toFixed(2)}%` : '—'

  return (
    <div className="feu-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, color: 'var(--green)', margin: 0 }}>Grade Sheet</h2>
        <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{cls.displayName}</span>
        <span style={{ fontSize: 12, color: 'var(--gray)' }}>{students.length} student{students.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, padding: '7px 12px', background: '#f1f7f3', borderRadius: 5, border: '1px solid var(--border)', fontSize: 12, color: 'var(--gray)' }}>
        <span><strong style={{ color: 'var(--ink)' }}>Grade weights:</strong>&nbsp; Quizzes&nbsp;{Math.round(wtQuiz * 100)}%&nbsp;·&nbsp;Papers/HW&nbsp;{Math.round(wtPaper * 100)}%&nbsp;·&nbsp;Exam&nbsp;{Math.round(wtExam * 100)}%</span>
        <span>[Q]&nbsp;Quiz&nbsp;·&nbsp;[P]&nbsp;Paper/Activity&nbsp;·&nbsp;[E]&nbsp;Exam</span>
        <span><span style={{ color: 'var(--gold-dk)' }}>•</span>&nbsp;amber&nbsp;=&nbsp;manually&nbsp;edited grade. Edit grades in the Grade Editor below.</span>
      </div>

      {students.length === 0 && <p className="feu-muted">No students enrolled in this section.</p>}
      {students.length > 0 && assessments.length === 0 && (
        <p className="feu-muted">No assessments assigned yet. Add assessments from the class detail page.</p>
      )}

      {students.length > 0 && assessments.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', minWidth: '100%' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 140 }}>Name</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 90 }}>Student&nbsp;#</th>
                <th colSpan={mSpan} style={{ ...groupTh, background: '#c4e8d4', borderLeft: '2px solid var(--green)' }}>MIDTERM</th>
                <th colSpan={fSpan} style={{ ...groupTh, background: '#c4e8d4', borderLeft: '2px solid var(--green)' }}>FINAL</th>
                <th colSpan={2} style={{ ...groupTh, background: '#ffe99a', borderLeft: '2px solid var(--gold)' }}>COURSE GRADE</th>
              </tr>
              <tr>
                {midtermCols.map((a, i) => colHeader(a, i === 0))}
                <th style={{ ...thBase, background: '#a8d8bc', fontWeight: 700, borderLeft: '1px solid #7bbfa0', textAlign: 'center', minWidth: 56 }}>MG</th>
                {finalCols.map((a, i) => colHeader(a, i === 0))}
                <th style={{ ...thBase, background: '#a8d8bc', fontWeight: 700, borderLeft: '1px solid #7bbfa0', textAlign: 'center', minWidth: 56 }}>FG</th>
                <th style={{ ...thBase, background: '#fcd34d', fontWeight: 700, borderLeft: '2px solid var(--gold)', textAlign: 'center', minWidth: 66 }}>MARK</th>
                <th style={{ ...thBase, background: '#fcd34d', fontWeight: 700, textAlign: 'center', minWidth: 48 }}>LG</th>
              </tr>
            </thead>
            <tbody>
              {students.map((stu, i) => {
                const rowBg = i % 2 === 0 ? '#fff' : '#f8fbf9'
                return (
                  <tr key={stu.studentId} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 500, textAlign: 'left', position: 'sticky', left: 0, background: rowBg, zIndex: 1, borderRight: '1px solid var(--border)' }}>
                      {stu.fullName || <span className="feu-muted">—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--gray)', borderRight: '1px solid var(--border)' }}>{stu.studentNumber ?? '—'}</td>
                    {midtermCols.map((a) => (
                      <ReadCell key={a.id} pct={stu.cells[a.assessmentId] ?? null}
                        isManual={stu.rawOverrides[a.assessmentId] !== undefined}
                        autoPct={stu.autoRaw[a.assessmentId] !== undefined && a.totalPoints > 0 ? (stu.autoRaw[a.assessmentId] / a.totalPoints) * 100 : null} />
                    ))}
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: stu.midtermMark !== null ? scoreColor(stu.midtermMark) : 'var(--gray)' }}>{markCell(stu.midtermMark)}</td>
                    {finalCols.map((a) => (
                      <ReadCell key={a.id} pct={stu.cells[a.assessmentId] ?? null}
                        isManual={stu.rawOverrides[a.assessmentId] !== undefined}
                        autoPct={stu.autoRaw[a.assessmentId] !== undefined && a.totalPoints > 0 ? (stu.autoRaw[a.assessmentId] / a.totalPoints) * 100 : null} />
                    ))}
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: stu.finalMark !== null ? scoreColor(stu.finalMark) : 'var(--gray)' }}>{markCell(stu.finalMark)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', borderLeft: '2px solid var(--gold)', textAlign: 'center', color: stu.courseMark !== null ? scoreColor(stu.courseMark) : 'var(--gray)' }}>{markCell(stu.courseMark)}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', textAlign: 'center', color: letterColor(stu.letter) }}>
                      {stu.letter ?? '—'}{stu.qp !== null && <span style={{ fontSize: 10, color: 'var(--gray)', marginLeft: 3 }}>({stu.qp.toFixed(1)})</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thBase: React.CSSProperties = { padding: '6px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#3c5a48', borderBottom: '2px solid var(--border)', background: '#f1f7f3', verticalAlign: 'bottom' }
const groupTh: React.CSSProperties = { textAlign: 'center', padding: '5px 10px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: '#3c5a48', borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '7px 10px', color: 'var(--ink)', textAlign: 'right' }
```

- [ ] **Step 2: Verify it compiles** (full build runs in Task 7; for now a quick check)

Run: `npx tsc --noEmit`
Expected: no errors referencing `GradeSheet.tsx` (the editor still imports old props until Task 5/6 — if `tsc` flags `GradesView.tsx`, that's expected and fixed in Task 6).

- [ ] **Step 3: Commit**

```bash
git add app/instructor/grades/GradeSheet.tsx
git commit -m "feat(grades): read-only Grade Sheet with % signs + amber manual marker"
```

---

### Task 5: Editable Grade Editor grid (live preview, batch save, safe revert)

**Files:**
- Rewrite: `app/instructor/grades/GradeEditor.tsx`

**Interfaces:**
- Produces: `export function GradeEditor({ grades, classId }: { grades: SectionGrades; classId: string }): JSX.Element`
- Consumes: `setGradeOverrides` (Task 2), `computeStudentMarks` + `MarkAssessment` (Task 1), `gradeStyles.ts` (Task 3), `SectionGrades`/`SectionAssessmentMeta` types.

**Behavior (encode exactly):**
- `editKey(studentId, assessmentId) = `${studentId}:${assessmentId}``.
- Staged edits live in `edits: Record<editKey, string>` (raw string the user typed; only touched cells).
- **Effective raw** for a cell = staged string if present, else `rawOverrides[a] ?? autoRaw[a] ?? ''` (override → auto → blank), as a display/prefill.
- **Preview cell %** for a student/assessment: if a staged value exists → blank means "fall back to auto" (`autoRaw[a]/total*100` or null), a number → `n/total*100`, invalid → use saved `cells[a]`; if no staged value → saved `cells[a]`. Feed the preview-% map to `computeStudentMarks` for the row's MG/FG/Mark/LG.
- **Dirty / save entry** per staged cell (the `≠-auto` rule): parse trimmed staged value; `desired = '' → null`, else `n` unless `auto!==undefined && n===auto` (→ null). `current = rawOverrides[a]`. Entry emitted only when `desired===null && current!==undefined` (delete) OR `desired!==null && current!==desired` (upsert). The set of cells emitting an entry = "dirty" (blue outline + counted in "N edited").
- **Destructive clear** = an emitted delete where `auto===undefined` (manual item losing its only score). Count these; if `>0`, `window.confirm` before saving.
- One cell open for editing at a time (`editingKey`). Click opens; `Enter`/blur closes (keeps staged); `Esc` restores the value present before this open and closes.
- **Discard** clears `edits` (resets to saved). **Save** builds entries; if none, show "No changes"; else (after confirm if destructive) call `setGradeOverrides`; on success the server `refresh()` remounts the page with fresh data and the editor re-initialises (it reads `edits` from `useState`, and a `key` on the inner grid keyed by a saved-data signature resets staged edits — same pattern used before).

- [ ] **Step 1: Rewrite `app/instructor/grades/GradeEditor.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { setGradeOverrides } from '@/app/actions/setGradeOverrides'
import { computeStudentMarks, type MarkAssessment } from '@/lib/gradebook'
import type { SectionGrades, SectionAssessmentMeta, SectionStudentRow } from '@/lib/types'
import { scoreColor, letterColor, typeTag, typeBg, splitPeriods, MANUAL_TINT, EDIT_OUTLINE, EDIT_TINT } from './gradeStyles'

const k = (s: string, a: string) => `${s}:${a}`
function fmt(n: number): string { return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100) }

export function GradeEditor({ grades, classId }: { grades: SectionGrades; classId: string }) {
  const { assessments, students, class: cls } = grades
  // Signature of saved data → remount (reset staged edits) after a save/refresh.
  const signature = students.map((s) =>
    assessments.map((a) => `${s.rawOverrides[a.assessmentId] ?? ''}/${s.autoRaw[a.assessmentId] ?? ''}`).join(',')
  ).join('|')
  return <EditorGrid key={signature} assessments={assessments} students={students} weights={cls.weights} classId={classId} />
}

function EditorGrid({ assessments, students, weights, classId }: {
  assessments: SectionAssessmentMeta[]
  students: SectionStudentRow[]
  weights: { wtQuiz: number; wtPaper: number; wtExam: number }
  classId: string
}) {
  const { midtermCols, finalCols } = splitPeriods(assessments)
  const mSpan = midtermCols.length + 1
  const fSpan = finalCols.length + 1
  const markAssessments: MarkAssessment[] = assessments.map((a) => ({ assessmentId: a.assessmentId, type: a.type, period: a.period }))

  const [edits, setEdits] = useState<Record<string, string>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function metaOf(aId: string) { return assessments.find((a) => a.assessmentId === aId)! }
  function effectiveRaw(stu: SectionStudentRow, a: SectionAssessmentMeta): string {
    const key = k(stu.studentId, a.assessmentId)
    if (edits[key] !== undefined) return edits[key]
    const ov = stu.rawOverrides[a.assessmentId]
    if (ov !== undefined) return String(ov)
    const auto = stu.autoRaw[a.assessmentId]
    if (auto !== undefined) return String(auto)
    return ''
  }
  function previewPct(stu: SectionStudentRow, a: SectionAssessmentMeta): number | null {
    const key = k(stu.studentId, a.assessmentId)
    if (edits[key] === undefined) return stu.cells[a.assessmentId] ?? null
    const t = edits[key].trim()
    if (t === '') { const auto = stu.autoRaw[a.assessmentId]; return auto !== undefined && a.totalPoints > 0 ? (auto / a.totalPoints) * 100 : null }
    const n = parseFloat(t)
    if (isNaN(n)) return stu.cells[a.assessmentId] ?? null
    return a.totalPoints > 0 ? (n / a.totalPoints) * 100 : null
  }
  // Returns a save entry for a touched cell, or null for no-op. Throws on invalid number.
  function entryFor(stu: SectionStudentRow, a: SectionAssessmentMeta): { studentId: string; assessmentId: string; score: number | null } | null {
    const key = k(stu.studentId, a.assessmentId)
    if (edits[key] === undefined) return null
    const t = edits[key].trim()
    const auto = stu.autoRaw[a.assessmentId]
    const current = stu.rawOverrides[a.assessmentId]
    let desired: number | null
    if (t === '') desired = null
    else { const n = parseFloat(t); if (isNaN(n)) throw new Error(`"${stu.fullName || 'student'}" / ${a.title}: "${t}" is not a number`); desired = (auto !== undefined && n === auto) ? null : n }
    if (desired === null) return current !== undefined ? { studentId: stu.studentId, assessmentId: a.assessmentId, score: null } : null
    return current === desired ? null : { studentId: stu.studentId, assessmentId: a.assessmentId, score: desired }
  }

  // Build entries + dirty set + destructive count for the current edits.
  let entries: { studentId: string; assessmentId: string; score: number | null }[] = []
  const dirty = new Set<string>()
  let destructive = 0
  let parseError: string | null = null
  try {
    for (const stu of students) for (const a of assessments) {
      const e = entryFor(stu, a)
      if (e) { entries.push(e); dirty.add(k(stu.studentId, a.assessmentId)); if (e.score === null && stu.autoRaw[a.assessmentId] === undefined) destructive++ }
    }
  } catch (err) { parseError = err instanceof Error ? err.message : 'Invalid input'; entries = [] }

  async function handleSave() {
    setError(null); setMsg(null)
    if (parseError) { setError(parseError); return }
    if (entries.length === 0) { setMsg('No changes to save.'); return }
    if (destructive > 0 && !window.confirm(`This removes ${destructive} hand-entered score${destructive > 1 ? 's' : ''} with no auto-grade to fall back to — continue?`)) return
    setSaving(true)
    try { await setGradeOverrides({ classId, entries }) }   // refresh() remounts with fresh data
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to save grades.'); setSaving(false) }
  }

  function openCell(key: string) { if (!saving) setEditingKey(key) }
  function setVal(key: string, v: string) { setEdits((p) => ({ ...p, [key]: v })) }

  function EditCell({ stu, a }: { stu: SectionStudentRow; a: SectionAssessmentMeta }) {
    const key = k(stu.studentId, a.assessmentId)
    const isEditing = editingKey === key
    const isDirty = dirty.has(key)
    const pct = previewPct(stu, a)
    const hasOverride = stu.rawOverrides[a.assessmentId] !== undefined
    const auto = stu.autoRaw[a.assessmentId]
    const display = effectiveRaw(stu, a)

    if (isEditing) {
      const valueBeforeOpen = display
      return (
        <td style={{ ...tdStyle, background: EDIT_TINT, outline: `2px solid ${EDIT_OUTLINE}`, outlineOffset: -2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <input autoFocus type="number" min={0} step={0.1} value={edits[key] ?? display}
                onChange={(e) => setVal(key, e.target.value)}
                onBlur={() => setEditingKey(null)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setEditingKey(null) } if (e.key === 'Escape') { setVal(key, valueBeforeOpen); setEditingKey(null) } }}
                style={{ width: 52, padding: '2px 4px', fontSize: 12, border: `1.5px solid ${EDIT_OUTLINE}`, borderRadius: 3, textAlign: 'right' }} />
              <span style={{ fontSize: 11, color: 'var(--gray)' }}>/ {a.totalPoints}</span>
            </div>
            {hasOverride && (auto !== undefined
              ? <button type="button" onMouseDown={(e) => { e.preventDefault(); setVal(key, String(auto)); setEditingKey(null) }} style={revertBtn}>↺ auto {fmt(auto)}</button>
              : <button type="button" onMouseDown={(e) => { e.preventDefault(); setVal(key, ''); setEditingKey(null) }} style={{ ...revertBtn, color: '#c0392b', borderColor: '#c0392b' }}>Clear</button>)}
          </div>
        </td>
      )
    }
    const tint = isDirty ? EDIT_TINT : hasOverride ? MANUAL_TINT : undefined
    const outline = isDirty ? `2px solid ${EDIT_OUTLINE}` : undefined
    return (
      <td style={{ ...tdStyle, cursor: 'pointer', userSelect: 'none', background: tint, outline, outlineOffset: -2 }}
        title={`Click to enter raw score out of ${a.totalPoints}`} onClick={() => openCell(key)}>
        {hasOverride && !isDirty && <span style={{ color: 'var(--gold-dk)', marginRight: 3 }}>•</span>}
        {display === '' ? <span style={{ color: 'var(--gray)' }}>—</span>
          : <span style={{ color: pct !== null ? scoreColor(pct) : 'var(--ink)', fontWeight: 500 }}>{display}</span>}
        <span style={{ color: 'var(--gray)', fontSize: 10 }}> / {a.totalPoints}</span>
      </td>
    )
  }

  function marksFor(stu: SectionStudentRow) {
    const cells: Record<string, number | null> = {}
    for (const a of assessments) cells[a.assessmentId] = previewPct(stu, a)
    return computeStudentMarks(cells, markAssessments, weights)
  }
  const markCell = (v: number | null) => v !== null ? `${v.toFixed(2)}%` : '—'

  return (
    <div className="feu-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: 16, color: 'var(--green)', margin: 0 }}>Grade Editor</h2>
        <span style={{ fontSize: 12, color: 'var(--gray)' }}>click a cell to enter a raw score; MG/FG/Mark preview live</span>
      </div>

      {students.length === 0 && <p className="feu-muted">No students enrolled in this section.</p>}
      {students.length > 0 && assessments.length === 0 && <p className="feu-muted">No assessments assigned yet.</p>}

      {students.length > 0 && assessments.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 140 }}>Name</th>
                  <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 90 }}>Student&nbsp;#</th>
                  <th colSpan={mSpan} style={{ ...groupTh, background: '#c4e8d4', borderLeft: '2px solid var(--green)' }}>MIDTERM</th>
                  <th colSpan={fSpan} style={{ ...groupTh, background: '#c4e8d4', borderLeft: '2px solid var(--green)' }}>FINAL</th>
                  <th colSpan={2} style={{ ...groupTh, background: '#ffe99a', borderLeft: '2px solid var(--gold)' }}>COURSE GRADE</th>
                </tr>
                <tr>
                  {midtermCols.map((a, i) => (
                    <th key={a.id} title={a.title} style={{ ...thBase, background: typeBg(a.type), maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: i === 0 ? '2px solid var(--green)' : undefined }}>
                      <span style={{ color: 'var(--gray)', marginRight: 2 }}>[{typeTag(a.type)}]</span>{a.title}
                    </th>
                  ))}
                  <th style={{ ...thBase, background: '#a8d8bc', fontWeight: 700, borderLeft: '1px solid #7bbfa0', textAlign: 'center', minWidth: 56 }}>MG</th>
                  {finalCols.map((a, i) => (
                    <th key={a.id} title={a.title} style={{ ...thBase, background: typeBg(a.type), maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: i === 0 ? '2px solid var(--green)' : undefined }}>
                      <span style={{ color: 'var(--gray)', marginRight: 2 }}>[{typeTag(a.type)}]</span>{a.title}
                    </th>
                  ))}
                  <th style={{ ...thBase, background: '#a8d8bc', fontWeight: 700, borderLeft: '1px solid #7bbfa0', textAlign: 'center', minWidth: 56 }}>FG</th>
                  <th style={{ ...thBase, background: '#fcd34d', fontWeight: 700, borderLeft: '2px solid var(--gold)', textAlign: 'center', minWidth: 66 }}>MARK</th>
                  <th style={{ ...thBase, background: '#fcd34d', fontWeight: 700, textAlign: 'center', minWidth: 48 }}>LG</th>
                </tr>
              </thead>
              <tbody>
                {students.map((stu, i) => {
                  const rowBg = i % 2 === 0 ? '#fff' : '#f8fbf9'
                  const m = marksFor(stu)
                  return (
                    <tr key={stu.studentId} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 500, textAlign: 'left', position: 'sticky', left: 0, background: rowBg, zIndex: 1, borderRight: '1px solid var(--border)' }}>{stu.fullName || <span className="feu-muted">—</span>}</td>
                      <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--gray)', borderRight: '1px solid var(--border)' }}>{stu.studentNumber ?? '—'}</td>
                      {midtermCols.map((a) => <EditCell key={a.id} stu={stu} a={a} />)}
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: m.midtermMark !== null ? scoreColor(m.midtermMark) : 'var(--gray)' }}>{markCell(m.midtermMark)}</td>
                      {finalCols.map((a) => <EditCell key={a.id} stu={stu} a={a} />)}
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: m.finalMark !== null ? scoreColor(m.finalMark) : 'var(--gray)' }}>{markCell(m.finalMark)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', borderLeft: '2px solid var(--gold)', textAlign: 'center', color: m.courseMark !== null ? scoreColor(m.courseMark) : 'var(--gray)' }}>{markCell(m.courseMark)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', textAlign: 'center', color: letterColor(m.letter) }}>{m.letter ?? '—'}{m.qp !== null && <span style={{ fontSize: 10, color: 'var(--gray)', marginLeft: 3 }}>({m.qp.toFixed(1)})</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <button type="button" onClick={handleSave} disabled={saving || entries.length === 0}
              style={{ padding: '7px 18px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: saving || entries.length === 0 ? 'default' : 'pointer', opacity: saving || entries.length === 0 ? 0.55 : 1 }}>
              {saving ? 'Saving…' : `Save changes${entries.length ? ` (${entries.length} edited)` : ''}`}
            </button>
            {entries.length > 0 && !saving && (
              <button type="button" onClick={() => { setEdits({}); setEditingKey(null); setError(null); setMsg(null) }}
                style={{ padding: '7px 12px', background: '#fff', color: 'var(--gray)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}>Discard</button>
            )}
            {error && <span style={{ color: '#c0392b', fontSize: 13 }}>{error}</span>}
            {msg && <span style={{ color: 'var(--gray)', fontSize: 13 }}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  )
}

const thBase: React.CSSProperties = { padding: '6px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#3c5a48', borderBottom: '2px solid var(--border)', background: '#f1f7f3', verticalAlign: 'bottom' }
const groupTh: React.CSSProperties = { textAlign: 'center', padding: '5px 10px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: '#3c5a48', borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '7px 10px', color: 'var(--ink)', textAlign: 'right' }
const revertBtn: React.CSSProperties = { padding: '1px 6px', fontSize: 10, background: '#fff', color: 'var(--gold-dk)', border: '1px solid var(--gold-dk)', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }
```

- [ ] **Step 2: Commit** (build/verify happens in Task 7 once wiring is done)

```bash
git add app/instructor/grades/GradeEditor.tsx
git commit -m "feat(grades): editable Grade Editor grid (live preview, batch save, safe revert)"
```

---

### Task 6: Wire the page; remove GradesView

**Files:**
- Delete: `app/instructor/grades/GradesView.tsx`
- Modify: `app/instructor/grades/page.tsx`

**Interfaces:**
- Consumes: `GradeSheet` (Task 4), `GradeEditor` (Task 5).

- [ ] **Step 1: Delete `GradesView.tsx`**

```bash
git rm app/instructor/grades/GradesView.tsx
```

- [ ] **Step 2: Edit `app/instructor/grades/page.tsx`** — swap the import + render both grids.

Replace `import { GradesView } from './GradesView'` with:
```tsx
import { GradeSheet } from './GradeSheet'
import { GradeEditor } from './GradeEditor'
```
Replace `{grades && <GradesView grades={grades} classId={classId!} />}` with:
```tsx
{grades && (
  <>
    <GradeSheet grades={grades} />
    <GradeEditor grades={grades} classId={classId!} />
  </>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/instructor/grades/page.tsx
git commit -m "feat(grades): render Grade Sheet + Grade Editor; drop GradesView wrapper"
```

---

### Task 7: Verify (build, tests, e2e, interaction) + docs

**Files:**
- Modify: `CONTINUE.md`
- Test: full suite + e2e + interaction script

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: build succeeds; `/instructor/grades` listed. Fix any type errors (e.g. stale references to removed props).

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green (≥ prior count; the section-grades + override-editor + gradebook tests cover the changed logic).

- [ ] **Step 3: e2e smoke** (fresh terminal flow)

```bash
supabase db reset && node e2e/seed.mjs
# start a LOCAL-pointed dev server on :3100 (inline env), then:
node e2e/smoke.mjs
```
Expected: `SUMMARY: 12/12 OK`, no loops/console/page errors on `/instructor/grades`.

- [ ] **Step 4: Interaction test** — adapt the prior `verify_editor.mjs` to the grid UI. Save it under the project root, run, then delete. It must assert:
  1. Clicking a cell, typing a value ≠ auto, then **Save changes** → an override row exists with that score; the **Grade Sheet** cell shows the new `%` with an amber dot.
  2. The editor's **MG** updates *before* Save (live preview): read the MG cell text after typing, before clicking Save.
  3. Online cell `↺ auto N` (open cell → click revert → Save) → override deleted, cell back to auto.
  4. Clearing a **manual** graded cell → on Save a `window.confirm` appears (accept it via `page.on('dialog', d => d.accept())`) → override deleted.

```js
// key selectors: cells are <td> with title^="Click to enter raw score"; click to open,
// then `input[type=number]` appears. Save button text: "Save changes". MG is the <td>
// after the last midterm column. Use the DB (service key) to assert override rows, as in
// the previous verify script.
```
Run: `node ./_verify_grid_tmp.mjs` (from project root, local dev server on :3100). Expected: all checks PASS.

- [ ] **Step 5: Update `CONTINUE.md`** — replace the "✅ GRADE EDITOR — BUILT" section's description with the two-grid design (read-only Grade Sheet + editable Grade Editor grid, live preview, % signs, amber manual marker, safe revert/clear), note the spec/plan paths, and the verification results.

- [ ] **Step 6: Commit**

```bash
git add CONTINUE.md
git commit -m "docs: grade editor redesigned to two-grid layout (sheet + editor); verified"
```

---

## Self-Review

**Spec coverage:**
- Grade Sheet heading + `%` signs + amber marker → Task 4 ✓
- Grade Editor full grid, click-to-edit `raw/total`, live MG/FG/Mark/LG preview → Task 5 ✓
- Edited-blue / saved-manual-amber coloring, Discard, Save (N edited) → Task 5 ✓
- Safe revert (online one-click) / Clear (manual) + Save-time confirm → Task 5 ✓
- Shared marks math (no drift) → Task 1 ✓
- Batch action across assessments → Task 2 ✓
- Shared color/marker helpers → Task 3 ✓
- Remove GradesView + clickable-header selection → Tasks 4, 6 ✓
- Tests (action, computeStudentMarks via gradebook+section-grades, e2e, interaction) → Tasks 1,2,7 ✓

**Placeholder scan:** none — all steps carry real code/commands.

**Type consistency:** `computeStudentMarks(cells, MarkAssessment[], weights)` defined in Task 1 and consumed in Task 5; `setGradeOverrides({classId, entries:[{studentId,assessmentId,score}]})` defined Task 2, consumed Task 5; `gradeStyles` exports (`scoreColor`, `letterColor`, `typeTag`, `typeBg`, `splitPeriods`, `MANUAL_TINT`, `EDIT_OUTLINE`, `EDIT_TINT`) defined Task 3, consumed Tasks 4–5. `GradeSheet({grades})` / `GradeEditor({grades, classId})` signatures match Task 6 usage.
