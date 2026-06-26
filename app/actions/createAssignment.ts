'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface CreateAssignmentInput {
  assessmentId: string
  classId: string
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
  const { data: cls, error: clsErr } = await admin
    .from('classes').select('id, instructor_id').eq('id', input.classId).single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  const { data: inserted, error: insErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: input.assessmentId,
      class_id: input.classId,
      instructor_id: cls.instructor_id,
      opens_at: input.opensAt ?? null,
      closes_at: input.closesAt ?? null,
      due_date: input.dueDate ?? null,
    })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error(`Failed to create assignment: ${insErr?.message ?? 'unknown'}`)
  return { assignmentId: inserted.id }
}
