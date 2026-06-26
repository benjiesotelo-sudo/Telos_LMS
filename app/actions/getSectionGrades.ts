'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  categoryAverage,
  periodMark,
  courseMark,
  gradeFor,
} from '@/lib/gradebook'
import type { SectionGrades, SectionAssessmentMeta, SectionStudentRow } from '@/lib/types'

export async function getSectionGrades(input: {
  classId: string
}): Promise<SectionGrades> {
  // ── 1. Auth + owner guard ────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()
  const isAdmin = caller?.role === 'admin'

  // Use admin client for all subsequent reads so RLS doesn't filter rows.
  const admin = createAdminClient()

  // Load the class (weights + course info for displayName).
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select(
      'id, instructor_id, wt_quiz, wt_paper, wt_exam, section_label, course:course_id(code, title)',
    )
    .eq('id', input.classId)
    .single()
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

  // ── 2. Enrolled students ────────────────────────────────────────────────
  // Include all enrollment rows regardless of status (active + pending).
  // Rationale: an instructor may want to see grades for students still in
  // pending status; status-based filtering should happen at the UI layer.
  const { data: enrollments, error: enrollErr } = await admin
    .from('enrollments')
    .select('student_id, profile:student_id(full_name, student_number)')
    .eq('class_id', input.classId)
  if (enrollErr) throw new Error(`Failed to load enrollments: ${enrollErr.message}`)

  const students = (enrollments ?? []).map((e: any) => ({
    studentId:     e.student_id as string,
    fullName:      (e.profile?.full_name      ?? '') as string,
    studentNumber: (e.profile?.student_number ?? null) as string | null,
  }))

  // ── 3. Class assignments + assessment metadata ──────────────────────────
  const { data: assignments, error: assignErr } = await admin
    .from('assignments')
    .select('id, assessment_id, period, assessment:assessment_id(title, type)')
    .eq('class_id', input.classId)
  if (assignErr) throw new Error(`Failed to load assignments: ${assignErr.message}`)

  const assessmentMetas: SectionAssessmentMeta[] = (assignments ?? []).map((a: any) => ({
    id:           a.id           as string,
    assessmentId: a.assessment_id as string,
    title:        (a.assessment?.title ?? '') as string,
    type:         (a.assessment?.type  ?? 'quiz') as 'activity' | 'quiz' | 'exam',
    period:       a.period as 'midterm' | 'final',
  }))

  // Early return when there are no students or no assignments.
  if (students.length === 0 || assessmentMetas.length === 0) {
    return {
      class: { id: input.classId, displayName, weights },
      assessments: assessmentMetas,
      students: students.map((s) => ({
        ...s,
        cells:       {},
        midtermMark: null,
        finalMark:   null,
        courseMark:  null,
        letter:      null,
        qp:          null,
      })),
    }
  }

  const studentIds    = students.map((s) => s.studentId)
  const assignmentIds = assessmentMetas.map((a) => a.id)

  // ── 4. Submissions (auto-graded scores) ─────────────────────────────────
  const { data: submissions, error: subErr } = await admin
    .from('submissions')
    .select('assignment_id, student_id, earned, possible')
    .in('assignment_id', assignmentIds)
    .in('student_id', studentIds)
  if (subErr) throw new Error(`Failed to load submissions: ${subErr.message}`)

  // Map key: `${assignmentId}:${studentId}` → { earned, possible }
  const subMap = new Map<string, { earned: number; possible: number }>()
  for (const sub of submissions ?? []) {
    subMap.set(`${sub.assignment_id}:${sub.student_id}`, {
      earned:   Number(sub.earned),
      possible: Number(sub.possible),
    })
  }

  // ── 5. Grade overrides (manual scores; take priority) ───────────────────
  const { data: overrides, error: ovErr } = await admin
    .from('grade_overrides')
    .select('student_id, assessment_id, score')
    .eq('class_id', input.classId)
    .in('student_id', studentIds)
  if (ovErr) throw new Error(`Failed to load grade overrides: ${ovErr.message}`)

  // Map key: `${studentId}:${assessmentId}` → score (may exceed 100)
  const overrideMap = new Map<string, number>()
  for (const ov of overrides ?? []) {
    overrideMap.set(`${ov.student_id}:${ov.assessment_id}`, Number(ov.score))
  }

  // ── 6. Compute per-student cells + grades ───────────────────────────────
  const studentRows: SectionStudentRow[] = students.map((stu) => {
    // --- cells ---
    const cells: Record<string, number | null> = {}

    for (const asmt of assessmentMetas) {
      const overrideKey   = `${stu.studentId}:${asmt.assessmentId}`
      const submissionKey = `${asmt.id}:${stu.studentId}`

      if (overrideMap.has(overrideKey)) {
        // Manual override takes priority (may exceed 100 for bonus).
        cells[asmt.assessmentId] = overrideMap.get(overrideKey)!
      } else {
        const sub = subMap.get(submissionKey)
        if (sub && sub.possible > 0) {
          // Auto-graded submission percentage.
          cells[asmt.assessmentId] = (sub.earned / sub.possible) * 100
        } else {
          // No submission (or ungraded with possible=0).
          cells[asmt.assessmentId] = null
        }
      }
    }

    // --- group non-null cells by period + category ---
    const groups: Record<
      'midterm' | 'final',
      { quizzes: number[]; papers: number[]; exam: number[] }
    > = {
      midterm: { quizzes: [], papers: [], exam: [] },
      final:   { quizzes: [], papers: [], exam: [] },
    }

    for (const asmt of assessmentMetas) {
      const val = cells[asmt.assessmentId]
      if (val === null) continue
      const g = groups[asmt.period]
      if      (asmt.type === 'quiz')     g.quizzes.push(val)
      else if (asmt.type === 'activity') g.papers.push(val)
      else if (asmt.type === 'exam')     g.exam.push(val)
    }

    // --- period marks (uses lib/gradebook — no re-derived math) ---
    const midtermMark = periodMark(
      {
        quizzes: categoryAverage(groups.midterm.quizzes),
        papers:  categoryAverage(groups.midterm.papers),
        exam:    categoryAverage(groups.midterm.exam),
      },
      weights,
    )

    const finalMark = periodMark(
      {
        quizzes: categoryAverage(groups.final.quizzes),
        papers:  categoryAverage(groups.final.papers),
        exam:    categoryAverage(groups.final.exam),
      },
      weights,
    )

    // --- course mark + letter ---
    const cm    = courseMark(midtermMark, finalMark)
    const grade = gradeFor(cm)

    return {
      studentId:     stu.studentId,
      fullName:      stu.fullName,
      studentNumber: stu.studentNumber,
      cells,
      midtermMark,
      finalMark,
      courseMark:    cm,
      letter:        grade?.letter ?? null,
      qp:            grade?.qp     ?? null,
    }
  })

  return {
    class: { id: input.classId, displayName, weights },
    assessments: assessmentMetas,
    students: studentRows,
  }
}
