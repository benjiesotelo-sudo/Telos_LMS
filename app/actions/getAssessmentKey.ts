'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Question, AnswerKeyItem } from '@/lib/types'

export interface AssessmentKeyResult {
  title: string
  type: 'activity' | 'quiz' | 'exam'
  questions: Question[]
  answerKey: Record<string, AnswerKeyItem>
}

/**
 * Server action: return the assessment questions PLUS the answer key for the
 * owning instructor or an admin.
 *
 * Security contract:
 *   - Students are rejected BEFORE any key data is read.
 *   - Non-owner instructors are rejected BEFORE the key is read.
 *   - The answer key is read ONLY via the service-role admin client (bypasses RLS).
 *   - The answer key is NEVER returned to a student or a non-owner instructor.
 */
export async function getAssessmentKey(input: {
  assessmentId: string
}): Promise<AssessmentKeyResult> {
  // ── 1. Authenticate the caller ────────────────────────────────────────────
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  // ── 2. Read the caller's role (via auth client — subject to RLS) ──────────
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()

  // SECURITY: block students and unauthenticated roles BEFORE touching the key
  if (!caller || (caller.role !== 'instructor' && caller.role !== 'admin')) {
    throw new Error('Forbidden')
  }

  // ── 3. Read the assessment via the service-role client ────────────────────
  // Admin client is required because instructors cannot read other instructors'
  // assessments via RLS; we do the ownership check ourselves below.
  const admin = createAdminClient()

  const { data: assessment, error: asmtErr } = await admin
    .from('assessments')
    .select('title, type, questions, instructor_id')
    .eq('id', input.assessmentId)
    .single()

  if (asmtErr || !assessment) throw new Error('Assessment not found')

  // ── 4. Ownership guard ────────────────────────────────────────────────────
  // Admins bypass ownership; instructors must own the assessment.
  if (caller.role !== 'admin' && assessment.instructor_id !== callerId) {
    throw new Error('Forbidden')
  }

  // ── 5. Read the answer key (service-role only; RLS has ZERO policies on this table) ──
  const { data: keyRow, error: keyErr } = await admin
    .from('assessment_keys')
    .select('answer_key')
    .eq('assessment_id', input.assessmentId)
    .single()

  if (keyErr || !keyRow) throw new Error('Answer key not found')

  return {
    title: assessment.title as string,
    type: assessment.type as 'activity' | 'quiz' | 'exam',
    questions: assessment.questions as Question[],
    answerKey: keyRow.answer_key as Record<string, AnswerKeyItem>,
  }
}
