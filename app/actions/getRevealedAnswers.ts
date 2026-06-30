'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Question, AnswerKeyItem } from '@/lib/types'

export interface RevealedAnswersResult {
  questions: Question[]
  correctAnswers: Record<string, AnswerKeyItem>
  myAnswers: Record<string, unknown>
}

/**
 * Server action: return the correct answers for a student's OWN closed +
 * graded submission, but ONLY when the instructor has enabled answer reveal.
 *
 * Security contract:
 *   - Caller must be authenticated.
 *   - The submission MUST belong to the caller — another student requesting a
 *     foreign submission receives a 'Forbidden' error (thrown before any key
 *     data is touched).
 *   - The answer key is returned ONLY when the reveal gate passes:
 *       1. assignment.reveal_answers === true        (instructor toggle)
 *       2. submission.status === 'graded'
 *       3. Close gate (SAME for every type — quiz/exam/homework/activity): reveals when
 *          there is NO closes_at, OR once a set closes_at has passed. Only a FUTURE
 *          closes_at holds answers back (so classmates still taking aren't shown early).
 *   - When the gate fails the function returns null — the key is never read.
 *   - The answer key is read EXCLUSIVELY via the service-role admin client
 *     (assessment_keys has zero public RLS policies).
 */
export async function getRevealedAnswers(input: {
  submissionId: string
}): Promise<RevealedAnswersResult | null> {
  // ── 1. Authenticate the caller ────────────────────────────────────────────
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  // ── 2. Load the submission via admin client (bypasses RLS) ────────────────
  // We use the admin client so the query works regardless of the caller's RLS
  // policies on submissions.  The ownership check is performed explicitly below.
  const admin = createAdminClient()

  const { data: submission, error: subErr } = await admin
    .from('submissions')
    .select('id, student_id, assignment_id, answers, status')
    .eq('id', input.submissionId)
    .single()

  if (subErr || !submission) throw new Error('Submission not found')

  // ── 3. Ownership guard — BEFORE any key data is touched ───────────────────
  if (submission.student_id !== callerId) {
    throw new Error('Forbidden')
  }

  // ── 4. Load the assignment ────────────────────────────────────────────────
  const { data: assignment, error: asgErr } = await admin
    .from('assignments')
    .select('assessment_id, reveal_answers, closes_at')
    .eq('id', submission.assignment_id)
    .single()

  if (asgErr || !assignment) throw new Error('Assignment not found')

  // ── 5. Gate — reveal (same rule for ALL types) ───────────────────────────
  // Reveal when there's no close time, or once a set close time has passed — only a
  // FUTURE close holds answers back (so classmates still taking aren't shown early).
  // The instructor's Reveal toggle + the graded + ownership checks safeguard everything.
  const revealEnabled = assignment.reveal_answers === true
  const isGraded = submission.status === 'graded'
  const closeSatisfied =
    assignment.closes_at == null || new Date(assignment.closes_at) <= new Date()

  if (!revealEnabled || !isGraded || !closeSatisfied) {
    return null
  }

  // ── 6. Read assessment questions + answer key via service-role only ───────
  const { data: assessment, error: asmtErr } = await admin
    .from('assessments')
    .select('questions')
    .eq('id', assignment.assessment_id)
    .single()

  if (asmtErr || !assessment) throw new Error('Assessment not found')

  const { data: keyRow, error: keyErr } = await admin
    .from('assessment_keys')
    .select('answer_key')
    .eq('assessment_id', assignment.assessment_id)
    .single()

  if (keyErr || !keyRow) throw new Error('Answer key not found')

  return {
    questions: assessment.questions as Question[],
    correctAnswers: keyRow.answer_key as Record<string, AnswerKeyItem>,
    myAnswers: (submission.answers ?? {}) as Record<string, unknown>,
  }
}
