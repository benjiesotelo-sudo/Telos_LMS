'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface CreateAssignmentInput {
  assessmentId: string
  classId: string
  period: 'midterm' | 'final'
  active?: boolean
  revealAnswers?: boolean
  opensAt?: string
  closesAt?: string
  dueDate?: string
  /** Per-attempt time limit (minutes). If omitted, inherits the assessment's default. */
  durationMinutes?: number | null
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

  // Time limit: explicit value wins; otherwise inherit the assessment's default.
  let durationMinutes = input.durationMinutes ?? null
  if (input.durationMinutes === undefined) {
    const { data: asmt } = await admin
      .from('assessments').select('default_duration_minutes').eq('id', input.assessmentId).single()
    durationMinutes = (asmt?.default_duration_minutes ?? null) as number | null
  }

  const { data: inserted, error: insErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: input.assessmentId,
      class_id: input.classId,
      instructor_id: cls.instructor_id,
      period: input.period,
      active: input.active ?? true,
      reveal_answers: input.revealAnswers ?? false,
      opens_at: input.opensAt ?? null,
      closes_at: input.closesAt ?? null,
      due_date: input.dueDate ?? null,
      duration_minutes: durationMinutes != null && durationMinutes > 0 ? Math.round(durationMinutes) : null,
    })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error(`Failed to create assignment: ${insErr?.message ?? 'unknown'}`)
  refresh()
  return { assignmentId: inserted.id }
}
