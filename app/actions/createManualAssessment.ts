'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

const VALID_TYPES = ['activity', 'quiz', 'exam'] as const
type AssessmentType = (typeof VALID_TYPES)[number]

export async function createManualAssessment(input: {
  title: string
  type: AssessmentType
  totalPoints: number
}): Promise<{ assessmentId: string }> {
  // --- validation ---
  if (!input.title.trim()) {
    throw new Error('title must not be empty')
  }
  if (!(VALID_TYPES as readonly string[]).includes(input.type)) {
    throw new Error(`type must be one of: ${VALID_TYPES.join(', ')}`)
  }
  if (typeof input.totalPoints !== 'number' || input.totalPoints <= 0) {
    throw new Error('total_points must be a positive number')
  }

  // --- caller identity + role gate ---
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'instructor' && profile.role !== 'admin')) {
    throw new Error('Forbidden: instructor or admin required')
  }

  // --- insert manual assessment (no answer key row) ---
  const { data: inserted, error: insErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: user.id,
      title: input.title.trim(),
      type: input.type,
      total_points: input.totalPoints,
      questions: [],
      is_manual: true,
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    throw new Error(`Failed to create assessment: ${insErr?.message ?? 'unknown'}`)
  }

  refresh()
  return { assessmentId: inserted.id }
}
