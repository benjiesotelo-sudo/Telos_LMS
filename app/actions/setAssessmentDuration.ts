'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

/**
 * Set (or clear) the default per-attempt time limit on an assessment. This value
 * pre-fills the limit when the assessment is assigned to a section; null = untimed.
 * Owner/admin-guarded.
 */
export async function setAssessmentDuration(input: {
  assessmentId: string
  minutes: number | null
}): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()
  const { data: asmt, error: asmtErr } = await admin
    .from('assessments')
    .select('instructor_id')
    .eq('id', input.assessmentId)
    .single()
  if (asmtErr || !asmt) throw new Error('Assessment not found')
  if (!isAdmin && asmt.instructor_id !== callerId) throw new Error('Not the assessment owner')

  const minutes =
    input.minutes != null && Number.isFinite(input.minutes) && input.minutes > 0
      ? Math.round(input.minutes)
      : null

  const { error: updErr } = await admin
    .from('assessments')
    .update({ default_duration_minutes: minutes })
    .eq('id', input.assessmentId)
  if (updErr) throw new Error(`Failed to set duration: ${updErr.message}`)

  refresh()
  return { ok: true }
}
