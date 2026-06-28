'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface UpdateAssessmentSettingsInput {
  assessmentId: string
  title?: string
  type?: 'quiz' | 'homework' | 'activity' | 'exam'
  /** Default per-attempt time limit in minutes; null = untimed. Omit to leave unchanged. */
  defaultDurationMinutes?: number | null
  /** Counts toward the grade. Only meaningful for homework/activity — quiz/exam are forced graded. */
  isGraded?: boolean
}

/**
 * Edit an assessment's settings (name, type, default time limit). Owner/admin-guarded.
 * Changing the type changes its grading category (quiz/paper/exam weighting) but does
 * not alter existing submissions. Only the provided fields are updated.
 */
export async function updateAssessmentSettings(
  input: UpdateAssessmentSettingsInput,
): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()
  const { data: asmt, error: asmtErr } = await admin
    .from('assessments')
    .select('instructor_id, type')
    .eq('id', input.assessmentId)
    .single()
  if (asmtErr || !asmt) throw new Error('Assessment not found')
  if (!isAdmin && asmt.instructor_id !== callerId) throw new Error('Not the assessment owner')

  const update: Record<string, unknown> = {}

  if (input.title !== undefined) {
    const t = input.title.trim()
    if (t.length === 0) throw new Error('Title cannot be empty')
    update.title = t
  }
  if (input.type !== undefined) {
    if (!['quiz', 'homework', 'activity', 'exam'].includes(input.type)) throw new Error('Invalid assessment type')
    update.type = input.type
  }
  if (input.defaultDurationMinutes !== undefined) {
    update.default_duration_minutes =
      input.defaultDurationMinutes != null &&
      Number.isFinite(input.defaultDurationMinutes) &&
      input.defaultDurationMinutes > 0
        ? Math.round(input.defaultDurationMinutes)
        : null
  }

  // Graded flag: quizzes & exams are ALWAYS graded. Homework/activity may be ungraded (practice).
  const effectiveType = (input.type ?? asmt.type) as string
  if (effectiveType === 'quiz' || effectiveType === 'exam') {
    update.is_graded = true
  } else if (input.isGraded !== undefined) {
    update.is_graded = input.isGraded
  }

  if (Object.keys(update).length === 0) return { ok: true }

  const { error: updErr } = await admin.from('assessments').update(update).eq('id', input.assessmentId)
  if (updErr) throw new Error(`Failed to update assessment: ${updErr.message}`)

  refresh()
  return { ok: true }
}
