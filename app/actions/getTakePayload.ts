'use server'

import { createClient } from '@/lib/supabase/server'
import type { Question, ComponentType } from '@/lib/types'

export async function getTakePayload(
  assignmentId: string,
): Promise<{ title: string; type: ComponentType; questions: Question[] }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  // Account must be active to take an assessment (suspended/pending are blocked,
  // even with a live session). Defense-in-depth alongside the is_active() RLS gate.
  const { data: me } = await supabase.from('profiles').select('status').eq('id', user.id).single()
  if (me?.status !== 'active') throw new Error('Your account is not active.')

  // RLS on assignments only returns rows the caller is enrolled in (or owns).
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, assessment_id, class_id, opens_at, closes_at, active')
    .eq('id', assignmentId)
    .single()
  if (aErr || !assignment) throw new Error('Assignment not found or you are not enrolled.')

  if (assignment.active === false) throw new Error('This assessment is not currently available.')

  const now = Date.now()
  const opensAt = assignment.opens_at ? new Date(assignment.opens_at).getTime() : null
  const closesAt = assignment.closes_at ? new Date(assignment.closes_at).getTime() : null
  const isOpen =
    (opensAt === null || now >= opensAt) && (closesAt === null || now < closesAt)
  if (!isOpen) throw new Error('This assessment is not open.')

  // Reads ONLY assessments.questions — assessment_keys is never touched here.
  const { data: assessment, error: asErr } = await supabase
    .from('assessments')
    .select('title, type, questions, is_manual')
    .eq('id', assignment.assessment_id)
    .single()
  if (asErr || !assessment) throw new Error('Assessment not found.')

  if (assessment.is_manual)
    throw new Error('This is a manually-graded assessment and cannot be taken online.')

  return {
    title: assessment.title,
    type: assessment.type as ComponentType,
    questions: assessment.questions as Question[],
  }
}
