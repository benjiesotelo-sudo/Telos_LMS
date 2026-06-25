'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface CreateAssignmentInput {
  assessmentId: string
  courseId: string
  periodId: string
  pic: string
  opensAt?: string
  closesAt?: string
  dueDate?: string
}

export async function createAssignment(input: CreateAssignmentInput): Promise<{ assignmentId: string }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()
  const { data: course, error: courseErr } = await admin
    .from('courses')
    .select('id, instructor_id')
    .eq('id', input.courseId)
    .single()
  if (courseErr || !course) throw new Error('Course not found')
  if (!isAdmin && course.instructor_id !== callerId) throw new Error('Not the course owner')

  const { data: inserted, error: insErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: input.assessmentId,
      course_id: input.courseId,
      period_id: input.periodId,
      instructor_id: course.instructor_id,
      pic: input.pic,
      opens_at: input.opensAt ?? null,
      closes_at: input.closesAt ?? null,
      due_date: input.dueDate ?? null,
    })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error(`Failed to create assignment: ${insErr?.message ?? 'unknown'}`)

  return { assignmentId: inserted.id }
}
