'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { computeStudentMarks } from '@/lib/gradebook'
import type {
  StudentOverview,
  StudentClassSummary,
  StudentTask,
  StudentGrades,
  StudentClassGrade,
  SectionAssessmentMeta,
} from '@/lib/types'

// ── internal helpers (non-exported; may be sync) ─────────────────────────────

async function authedStudentId(): Promise<string> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  return auth.user.id
}

/** Reveal gate, mirrors getRevealedAnswers: graded + reveal_answers + (activity | closed). */
function revealable(
  type: string,
  revealAnswers: boolean,
  closesAt: string | null,
  graded: boolean,
): boolean {
  if (!graded || !revealAnswers) return false
  if (type === 'activity') return true
  return closesAt != null && new Date(closesAt) <= new Date()
}

interface RawClass {
  id: string
  section_label: string | null
  period: string | null
  wt_quiz: number
  wt_paper: number
  wt_exam: number
  course: { code: string; title: string } | null
}

/**
 * Shared fetch: returns the caller's enrolled (active) classes + every assignment
 * in them + the caller's submissions + their grade overrides — all in a handful of
 * batched queries (no N+1). Scoped to the authenticated student via the admin client.
 */
async function loadStudentClassData(studentId: string, onlyClassId?: string) {
  const admin = createAdminClient()

  // 1. Active enrollments → class ids
  let enrollQ = admin
    .from('enrollments')
    .select('class_id, status')
    .eq('student_id', studentId)
    .eq('status', 'active')
  if (onlyClassId) enrollQ = enrollQ.eq('class_id', onlyClassId)
  const { data: enrollments, error: enrollErr } = await enrollQ
  if (enrollErr) throw new Error(`Failed to load enrollments: ${enrollErr.message}`)
  const classIds = (enrollments ?? []).map((e: any) => e.class_id as string)
  if (classIds.length === 0) return { classes: [] as RawClass[], assignments: [] as any[], subMap: new Map<string, any>(), overrideMap: new Map<string, number>() }

  // 2. Classes, 3. assignments — concurrent
  const [{ data: classes, error: clsErr }, { data: assignments, error: asgErr }] = await Promise.all([
    admin
      .from('classes')
      .select('id, section_label, period, wt_quiz, wt_paper, wt_exam, course:course_id(code, title)')
      .in('id', classIds),
    admin
      .from('assignments')
      .select('id, class_id, assessment_id, period, active, reveal_answers, opens_at, closes_at, due_date, assessment:assessment_id(title, type, total_points, is_manual)')
      .in('class_id', classIds),
  ])
  if (clsErr) throw new Error(`Failed to load classes: ${clsErr.message}`)
  if (asgErr) throw new Error(`Failed to load assignments: ${asgErr.message}`)

  const assignmentIds = (assignments ?? []).map((a: any) => a.id as string)

  // 4. The student's submissions + 5. grade overrides — concurrent
  const [{ data: subs, error: subErr }, { data: overrides, error: ovErr }] = await Promise.all([
    assignmentIds.length
      ? admin.from('submissions').select('id, assignment_id, earned, possible, status').eq('student_id', studentId).in('assignment_id', assignmentIds)
      : Promise.resolve({ data: [], error: null } as any),
    admin.from('grade_overrides').select('assessment_id, class_id, score').eq('student_id', studentId).in('class_id', classIds),
  ])
  if (subErr) throw new Error(`Failed to load submissions: ${subErr.message}`)
  if (ovErr) throw new Error(`Failed to load grade overrides: ${ovErr.message}`)

  // submission keyed by assignment_id
  const subMap = new Map<string, { id: string; earned: number; possible: number; status: string }>()
  for (const s of subs ?? []) {
    subMap.set(s.assignment_id as string, {
      id: s.id as string,
      earned: Number(s.earned),
      possible: Number(s.possible),
      status: s.status as string,
    })
  }
  // override keyed by `${classId}:${assessmentId}`
  const overrideMap = new Map<string, number>()
  for (const o of overrides ?? []) {
    overrideMap.set(`${o.class_id}:${o.assessment_id}`, Number(o.score))
  }

  return { classes: (classes ?? []) as unknown as RawClass[], assignments: (assignments ?? []) as any[], subMap, overrideMap }
}

function buildTask(a: any, subMap: Map<string, any>, overrideMap: Map<string, number>, classId: string): StudentTask {
  const asmt = a.assessment ?? {}
  const type = (asmt.type ?? 'quiz') as 'activity' | 'quiz' | 'exam'
  const totalPoints = Number(asmt.total_points ?? 0)
  const sub = subMap.get(a.id)
  const graded = sub?.status === 'graded'
  const overrideKey = `${classId}:${a.assessment_id}`
  const override = overrideMap.get(overrideKey)

  // effective score %: override (raw/total) beats auto (earned/possible)
  let scorePct: number | null = null
  if (override !== undefined && totalPoints > 0) scorePct = (override / totalPoints) * 100
  else if (sub && sub.possible > 0 && graded) scorePct = (sub.earned / sub.possible) * 100

  return {
    assignmentId: a.id,
    assessmentId: a.assessment_id,
    title: asmt.title ?? '',
    type,
    period: a.period as 'midterm' | 'final',
    isManual: asmt.is_manual === true,
    active: a.active === true,
    revealAnswers: a.reveal_answers === true,
    opensAt: a.opens_at ?? null,
    closesAt: a.closes_at ?? null,
    dueDate: a.due_date ?? null,
    durationMinutes: null, // wired by the timer task
    submissionId: sub?.id ?? null,
    submitted: sub != null,
    graded,
    scorePct,
    canReview: revealable(type, a.reveal_answers === true, a.closes_at ?? null, graded),
  }
}

function assembleClasses(
  classes: RawClass[],
  assignments: any[],
  subMap: Map<string, any>,
  overrideMap: Map<string, number>,
): StudentClassSummary[] {
  return classes
    .map((cls) => {
      const tasks = assignments
        .filter((a) => a.class_id === cls.id)
        .map((a) => buildTask(a, subMap, overrideMap, cls.id))
      return {
        classId: cls.id,
        code: cls.course?.code ?? '—',
        title: cls.course?.title ?? '',
        sectionLabel: cls.section_label ?? '—',
        period: cls.period,
        tasks,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code) || a.sectionLabel.localeCompare(b.sectionLabel))
}

// ── exported actions ─────────────────────────────────────────────────────────

/** All of the student's active classes with their tasks + own submission status. */
export async function getStudentOverview(): Promise<StudentOverview> {
  const studentId = await authedStudentId()
  const { classes, assignments, subMap, overrideMap } = await loadStudentClassData(studentId)
  return { classes: assembleClasses(classes, assignments, subMap, overrideMap) }
}

/** One class's detail for the student (or null if not enrolled/active). */
export async function getStudentClassDetail(input: { classId: string }): Promise<StudentClassSummary | null> {
  const studentId = await authedStudentId()
  const { classes, assignments, subMap, overrideMap } = await loadStudentClassData(studentId, input.classId)
  const assembled = assembleClasses(classes, assignments, subMap, overrideMap)
  return assembled[0] ?? null
}

/**
 * Flat to-do list across classes: active, online (non-manual), not-yet-submitted
 * tasks that are currently open. Sorted by close/due date (soonest first).
 */
export async function getStudentTodo(): Promise<(StudentTask & { classId: string; classLabel: string })[]> {
  const studentId = await authedStudentId()
  const { classes, assignments, subMap, overrideMap } = await loadStudentClassData(studentId)
  const now = Date.now()
  const items: (StudentTask & { classId: string; classLabel: string })[] = []
  for (const cls of assembleClasses(classes, assignments, subMap, overrideMap)) {
    for (const t of cls.tasks) {
      if (!t.active || t.isManual || t.submitted) continue
      if (t.opensAt && new Date(t.opensAt).getTime() > now) continue // not open yet
      if (t.closesAt && new Date(t.closesAt).getTime() <= now) continue // already closed
      items.push({ ...t, classId: cls.classId, classLabel: `${cls.code} - ${cls.sectionLabel}` })
    }
  }
  const sortKey = (t: StudentTask) => {
    const d = t.closesAt ?? t.dueDate
    return d ? new Date(d).getTime() : Number.MAX_SAFE_INTEGER
  }
  return items.sort((a, b) => sortKey(a) - sortKey(b))
}

/** Read-only FEU grade breakdown for the student, per class. */
export async function getStudentGrades(): Promise<StudentGrades> {
  const studentId = await authedStudentId()
  const { classes, assignments, subMap, overrideMap } = await loadStudentClassData(studentId)

  const out: StudentClassGrade[] = classes.map((cls) => {
    const classAssignments = assignments.filter((a) => a.class_id === cls.id)
    const metas: SectionAssessmentMeta[] = classAssignments.map((a) => ({
      id: a.id,
      assessmentId: a.assessment_id,
      title: a.assessment?.title ?? '',
      type: (a.assessment?.type ?? 'quiz') as 'activity' | 'quiz' | 'exam',
      period: a.period as 'midterm' | 'final',
      totalPoints: Number(a.assessment?.total_points ?? 0),
    }))

    const cells: Record<string, number | null> = {}
    const rawOverrides: Record<string, number> = {}
    for (const m of metas) {
      const overrideKey = `${cls.id}:${m.assessmentId}`
      const override = overrideMap.get(overrideKey)
      if (override !== undefined) {
        rawOverrides[m.assessmentId] = override
        cells[m.assessmentId] = m.totalPoints > 0 ? (override / m.totalPoints) * 100 : null
      } else {
        const sub = subMap.get(m.id)
        cells[m.assessmentId] = sub && sub.possible > 0 && sub.status === 'graded' ? (sub.earned / sub.possible) * 100 : null
      }
    }

    const weights = { wtQuiz: Number(cls.wt_quiz), wtPaper: Number(cls.wt_paper), wtExam: Number(cls.wt_exam) }
    const marks = computeStudentMarks(cells, metas, weights)

    return {
      classId: cls.id,
      displayName: `${cls.course?.code ?? '—'} - ${cls.section_label ?? '—'}`,
      weights,
      assessments: metas,
      cells,
      rawOverrides,
      midtermMark: marks.midtermMark,
      finalMark: marks.finalMark,
      courseMark: marks.courseMark,
      letter: marks.letter,
      qp: marks.qp,
    }
  })

  return { classes: out.sort((a, b) => a.displayName.localeCompare(b.displayName)) }
}
