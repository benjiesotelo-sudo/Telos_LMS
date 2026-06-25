'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { gradeSubmission } from '@/lib/grading'
import type { AnswerKeyItem } from '@/lib/types'

export async function submitAssessment(
  input: { assignmentId: string; answers: Record<string, string> },
): Promise<{ submissionId: string; earned: number; possible: number }> {
  const { assignmentId, answers } = input
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  // RLS-scoped read: caller must be enrolled (or own) to see the assignment.
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, assessment_id, instructor_id, opens_at, closes_at')
    .eq('id', assignmentId)
    .single()
  if (aErr || !assignment) throw new Error('Assignment not found or you are not enrolled.')

  const now = Date.now()
  const opensAt = assignment.opens_at ? new Date(assignment.opens_at).getTime() : null
  const closesAt = assignment.closes_at ? new Date(assignment.closes_at).getTime() : null
  const isOpen =
    (opensAt === null || now >= opensAt) && (closesAt === null || now < closesAt)
  if (!isOpen) throw new Error('This assessment is not open.')

  // Privileged: answer_key is server-only (assessment_keys has no student policy).
  const admin = createAdminClient()
  const { data: keyRow, error: kErr } = await admin
    .from('assessment_keys')
    .select('answer_key')
    .eq('assessment_id', assignment.assessment_id)
    .single()
  if (kErr || !keyRow) throw new Error('Answer key not found.')

  const answerKey = keyRow.answer_key as Record<string, AnswerKeyItem>
  const { earned, possible } = gradeSubmission(answers, answerKey)
  const score = Math.round((earned / possible) * 10000) / 100

  const { data: inserted, error: iErr } = await admin
    .from('submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: user.id,
      instructor_id: assignment.instructor_id,
      answers,
      earned,
      possible,
      score,
      status: 'graded',
      graded_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (iErr) {
    // unique(assignment_id, student_id) violation => already submitted.
    if (iErr.code === '23505') throw new Error('You have already submitted this assessment.')
    throw new Error('Could not record your submission.')
  }

  return { submissionId: inserted!.id, earned, possible }
}
