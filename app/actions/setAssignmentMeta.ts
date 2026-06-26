'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface SetAssignmentMetaInput {
  assignmentId: string
  period?: 'midterm' | 'final'
  active?: boolean
  revealAnswers?: boolean
  opensAt?: string
  closesAt?: string
  dueDate?: string
}

export async function setAssignmentMeta(input: SetAssignmentMetaInput): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()

  // Load the assignment to find its class
  const { data: assignment, error: aErr } = await admin
    .from('assignments')
    .select('id, class_id')
    .eq('id', input.assignmentId)
    .single()
  if (aErr || !assignment) throw new Error('Assignment not found')

  // Verify caller owns the class (or is admin)
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select('instructor_id')
    .eq('id', assignment.class_id)
    .single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  // Build update object from only the provided fields
  const update: Record<string, unknown> = {}
  if (input.period !== undefined) update.period = input.period
  if (input.active !== undefined) update.active = input.active
  if (input.revealAnswers !== undefined) update.reveal_answers = input.revealAnswers
  if (input.opensAt !== undefined) update.opens_at = input.opensAt
  if (input.closesAt !== undefined) update.closes_at = input.closesAt
  if (input.dueDate !== undefined) update.due_date = input.dueDate

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await admin
      .from('assignments')
      .update(update)
      .eq('id', input.assignmentId)
    if (updErr) throw new Error(`Failed to update assignment: ${updErr.message}`)
  }

  refresh()
  return { ok: true }
}
