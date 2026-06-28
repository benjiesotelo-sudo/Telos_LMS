'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function authedStudent() {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  return auth.user.id
}

async function assertEnrolledInAssignment(
  admin: ReturnType<typeof createAdminClient>,
  assignmentId: string,
  studentId: string,
) {
  const { data: asg } = await admin.from('assignments').select('class_id').eq('id', assignmentId).single()
  if (!asg) throw new Error('Assignment not found')
  const { data: enr } = await admin
    .from('enrollments')
    .select('id')
    .eq('class_id', asg.class_id)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()
  if (!enr) throw new Error('Not enrolled in this class')
}

/** Persist the student's in-progress answers server-side (cross-device resume). */
export async function saveDraft(input: {
  assignmentId: string
  answers: Record<string, string>
}): Promise<{ ok: true }> {
  const studentId = await authedStudent()
  const admin = createAdminClient()
  await assertEnrolledInAssignment(admin, input.assignmentId, studentId)

  // Don't overwrite a draft once the quiz is submitted (the submission is authoritative).
  const { data: sub } = await admin
    .from('submissions')
    .select('id')
    .eq('assignment_id', input.assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (sub) return { ok: true }

  const { error } = await admin
    .from('quiz_attempts')
    .upsert(
      { assignment_id: input.assignmentId, student_id: studentId, answers: input.answers },
      { onConflict: 'assignment_id,student_id' },
    )
  if (error) throw new Error(`Failed to save draft: ${error.message}`)
  return { ok: true }
}

/** Load the student's saved draft answers for an assignment ({} if none). */
export async function getDraft(input: { assignmentId: string }): Promise<Record<string, string>> {
  const studentId = await authedStudent()
  const admin = createAdminClient()
  await assertEnrolledInAssignment(admin, input.assignmentId, studentId)
  const { data } = await admin
    .from('quiz_attempts')
    .select('answers')
    .eq('assignment_id', input.assignmentId)
    .eq('student_id', studentId)
    .maybeSingle()
  return ((data?.answers ?? {}) as Record<string, string>)
}
