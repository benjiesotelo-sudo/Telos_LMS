'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ClassDetail } from '@/lib/types'

export async function getClassDetail(input: { classId: string }): Promise<ClassDetail> {
  // ── 1. Auth + owner guard ─────────────────────────────────────────────────
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

  // ── 2. Load the class ──────────────────────────────────────────────────────
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select(
      'id, course_id, instructor_id, wt_quiz, wt_paper, wt_exam, period, section_label, pic, course:course_id(code, title)',
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

  // ── 3. Assignments + assessment details ────────────────────────────────────
  const { data: assignments, error: assignErr } = await admin
    .from('assignments')
    .select(
      'id, assessment_id, period, active, reveal_answers, opens_at, closes_at, due_date, assessment:assessment_id(title, type)',
    )
    .eq('class_id', input.classId)
  if (assignErr) throw new Error(`Failed to load assignments: ${assignErr.message}`)

  const assessments = (assignments ?? []).map((a: any) => ({
    assignmentId:   a.id                       as string,
    assessmentId:   a.assessment_id             as string,
    title:          (a.assessment?.title ?? '') as string,
    type:           (a.assessment?.type  ?? 'quiz') as 'activity' | 'quiz' | 'exam',
    period:         a.period                    as 'midterm' | 'final',
    active:         a.active                    as boolean,
    revealAnswers:  a.reveal_answers            as boolean,
    opensAt:        (a.opens_at  ?? null)       as string | null,
    closesAt:       (a.closes_at ?? null)       as string | null,
    dueDate:        (a.due_date  ?? null)       as string | null,
  }))

  // ── 4. Enrolled students ───────────────────────────────────────────────────
  const { data: enrollments, error: enrollErr } = await admin
    .from('enrollments')
    .select('student_id, status, profile:student_id(full_name, student_number, email)')
    .eq('class_id', input.classId)
  if (enrollErr) throw new Error(`Failed to load enrollments: ${enrollErr.message}`)

  const students = (enrollments ?? []).map((e: any) => ({
    studentId:     e.student_id                          as string,
    fullName:      (e.profile?.full_name      ?? '')     as string,
    studentNumber: (e.profile?.student_number ?? null)   as string | null,
    email:         (e.profile?.email          ?? '')     as string,
    status:        (e.status                 ?? 'active') as string,
  }))

  return {
    class: {
      id:           input.classId,
      courseId:     (cls as any).course_id as string,
      displayName,
      code:         course?.code  ?? '',
      title:        course?.title ?? '',
      period:       cls.period        as string,
      sectionLabel: cls.section_label as string,
      pic:          (cls.pic ?? '')   as string,
      weights,
    },
    assessments,
    students,
  }
}
