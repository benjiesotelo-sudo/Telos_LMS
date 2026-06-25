'use server'

import { createClient } from '@/lib/supabase/server'
import type { Question, ComponentType } from '@/lib/types'

export async function getTakePayload(
  assignmentId: string,
): Promise<{ title: string; type: ComponentType; questions: Question[] }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  // RLS on assignments only returns rows the caller is enrolled in (or owns).
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, assessment_id, course_id, period_id, opens_at, closes_at')
    .eq('id', assignmentId)
    .single()
  if (aErr || !assignment) throw new Error('Assignment not found or you are not enrolled.')

  const now = Date.now()
  const opensAt = assignment.opens_at ? new Date(assignment.opens_at).getTime() : null
  const closesAt = assignment.closes_at ? new Date(assignment.closes_at).getTime() : null
  const isOpen =
    (opensAt === null || now >= opensAt) && (closesAt === null || now < closesAt)
  if (!isOpen) throw new Error('This assessment is not open.')

  // Reads ONLY assessments.questions — assessment_keys is never touched here.
  const { data: assessment, error: asErr } = await supabase
    .from('assessments')
    .select('title, type, questions')
    .eq('id', assignment.assessment_id)
    .single()
  if (asErr || !assessment) throw new Error('Assessment not found.')

  return {
    title: assessment.title,
    type: assessment.type as ComponentType,
    questions: assessment.questions as Question[],
  }
}
