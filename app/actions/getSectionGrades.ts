'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { computeStudentMarks } from '@/lib/gradebook'
import type { SectionGrades, SectionAssessmentMeta, SectionStudentRow } from '@/lib/types'

export async function getSectionGrades(input: {
  classId: string
}): Promise<SectionGrades> {
  // ── 1. Auth + owner guard ────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  // Use admin client for all subsequent reads so RLS doesn't filter rows.
  const admin = createAdminClient()

  // Caller role + class load are independent — run them together.
  const [{ data: caller }, { data: cls, error: clsErr }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', callerId).single(),
    admin
      .from('classes')
      .select(
        'id, instructor_id, wt_quiz, wt_paper, wt_exam, section_label, course:course_id(code, title)',
      )
      .eq('id', input.classId)
      .single(),
  ])
  const isAdmin = caller?.role === 'admin'
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  const course = (cls as any).course as { code: string; title: string } | null
  const displayName = course
    ? `${course.code} - ${cls.section_label}`
    : cls.section_label

  const weights = {
    wtQuiz:  Number(cls.wt_quiz),
    wtPaper: Number(cls.wt_paper),
    wtExam:  Number(cls.wt_exam),
  }

  // ── 2 + 3. Enrolled students + class assignments ────────────────────────
  // Both depend only on classId, so fetch them concurrently.
  //   Enrollments: include all rows regardless of status (active + pending) —
  //   an instructor may want to see grades for still-pending students;
  //   status-based filtering should happen at the UI layer.
  const [
    { data: enrollments, error: enrollErr },
    { data: assignments, error: assignErr },
  ] = await Promise.all([
    admin
      .from('enrollments')
      .select('student_id, profile:student_id(full_name, student_number)')
      .eq('class_id', input.classId),
    admin
      .from('assignments')
      .select('id, assessment_id, period, assessment:assessment_id(title, type, total_points)')
      .eq('class_id', input.classId),
  ])
  if (enrollErr) throw new Error(`Failed to load enrollments: ${enrollErr.message}`)
  if (assignErr) throw new Error(`Failed to load assignments: ${assignErr.message}`)

  const students = (enrollments ?? []).map((e: any) => ({
    studentId:     e.student_id as string,
    fullName:      (e.profile?.full_name      ?? '') as string,
    studentNumber: (e.profile?.student_number ?? null) as string | null,
  }))

  const assessmentMetas: SectionAssessmentMeta[] = (assignments ?? []).map((a: any) => ({
    id:           a.id           as string,
    assessmentId: a.assessment_id as string,
    title:        (a.assessment?.title ?? '') as string,
    type:         (a.assessment?.type  ?? 'quiz') as 'activity' | 'quiz' | 'exam',
    period:       a.period as 'midterm' | 'final',
    totalPoints:  Number(a.assessment?.total_points ?? 0),
  }))

  // Early return when there are no students or no assignments.
  if (students.length === 0 || assessmentMetas.length === 0) {
    return {
      class: { id: input.classId, displayName, weights },
      assessments: assessmentMetas,
      students: students.map((s) => ({
        ...s,
        cells:        {},
        rawOverrides: {},
        autoRaw:      {},
        midtermMark:  null,
        finalMark:    null,
        courseMark:   null,
        letter:       null,
        qp:           null,
      })),
    }
  }

  const studentIds    = students.map((s) => s.studentId)
  const assignmentIds = assessmentMetas.map((a) => a.id)

  // ── 4 + 5. Submissions (auto-graded) + grade overrides ──────────────────
  // Both keyed on the same student/assignment sets — fetch concurrently.
  const [
    { data: submissions, error: subErr },
    { data: overrides, error: ovErr },
  ] = await Promise.all([
    admin
      .from('submissions')
      .select('assignment_id, student_id, earned, possible, status')
      .in('assignment_id', assignmentIds)
      .in('student_id', studentIds),
    admin
      .from('grade_overrides')
      .select('student_id, assessment_id, score')
      .eq('class_id', input.classId)
      .in('student_id', studentIds),
  ])
  if (subErr) throw new Error(`Failed to load submissions: ${subErr.message}`)
  if (ovErr) throw new Error(`Failed to load grade overrides: ${ovErr.message}`)

  // Map key: `${assignmentId}:${studentId}` → { earned, possible }
  const subMap = new Map<string, { earned: number; possible: number; status: string }>()
  for (const sub of submissions ?? []) {
    subMap.set(`${sub.assignment_id}:${sub.student_id}`, {
      earned:   Number(sub.earned),
      possible: Number(sub.possible),
      status:   sub.status as string,
    })
  }

  // Map key: `${studentId}:${assessmentId}` → score (may exceed 100)
  const overrideMap = new Map<string, number>()
  for (const ov of overrides ?? []) {
    overrideMap.set(`${ov.student_id}:${ov.assessment_id}`, Number(ov.score))
  }

  // ── 6. Compute per-student cells + grades ───────────────────────────────
  const studentRows: SectionStudentRow[] = students.map((stu) => {
    // --- cells + rawOverrides + autoRaw ---
    const cells:        Record<string, number | null> = {}
    const rawOverrides: Record<string, number>        = {}
    const autoRaw:      Record<string, number>        = {}

    for (const asmt of assessmentMetas) {
      const overrideKey   = `${stu.studentId}:${asmt.assessmentId}`
      const submissionKey = `${asmt.id}:${stu.studentId}`
      const sub           = subMap.get(submissionKey)

      // Only GRADED submissions count toward grades (mirrors getStudentData) —
      // an in_progress/submitted row must not appear in the sheet.
      const graded = sub?.status === 'graded'

      // Surface the auto-graded raw score (submission.earned) for the editor —
      // independent of whether an override currently shadows it, so the editor
      // can show "auto N" and decide whether an entered value differs from auto.
      if (sub && graded) autoRaw[asmt.assessmentId] = sub.earned

      if (overrideMap.has(overrideKey)) {
        const rawScore = overrideMap.get(overrideKey)!
        // Store raw score so the GradeSheet can prefill the edit input.
        rawOverrides[asmt.assessmentId] = rawScore
        // Convert raw score → percentage using the assessment's total_points.
        // Guard: if total_points is somehow 0 (NOT NULL in schema, but defensive),
        // treat the cell as null to avoid division-by-zero.
        const tp = asmt.totalPoints
        cells[asmt.assessmentId] = tp > 0 ? (rawScore / tp) * 100 : null
      } else if (sub && graded && sub.possible > 0) {
        // Auto-graded submission percentage.
        cells[asmt.assessmentId] = (sub.earned / sub.possible) * 100
      } else {
        // No graded submission (or ungraded / possible=0).
        cells[asmt.assessmentId] = null
      }
    }

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
  })

  return {
    class: { id: input.classId, displayName, weights },
    assessments: assessmentMetas,
    students: studentRows,
  }
}
