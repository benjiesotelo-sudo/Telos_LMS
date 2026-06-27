'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface AttemptTimer {
  timed: boolean
  startedAt: string | null
  durationMinutes: number | null
  /** ISO deadline = started_at + duration (capped by closes_at). null when untimed. */
  deadline: string | null
}

/**
 * Records (once) when the student first opens a timed assignment and returns the
 * countdown deadline. The start time is set only on the first call — reopening
 * returns the SAME deadline, so the timer keeps running across refresh/device.
 * Untimed assignments return { timed: false }.
 */
export async function startAttempt(input: { assignmentId: string }): Promise<AttemptTimer> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const studentId = auth.user.id

  const admin = createAdminClient()

  const { data: asg, error: asgErr } = await admin
    .from('assignments')
    .select('id, class_id, duration_minutes, closes_at, assessment:assessment_id(default_duration_minutes)')
    .eq('id', input.assignmentId)
    .single()
  if (asgErr || !asg) throw new Error('Assignment not found')

  // Must be an active enrollee of the class.
  const { data: enr } = await admin
    .from('enrollments')
    .select('id')
    .eq('class_id', asg.class_id)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle()
  if (!enr) throw new Error('Not enrolled in this class')

  const defaultDuration = ((asg as any).assessment?.default_duration_minutes ?? null) as number | null
  const eff = (asg.duration_minutes ?? defaultDuration) as number | null
  if (eff == null) return { timed: false, startedAt: null, durationMinutes: null, deadline: null }

  // Insert the attempt start once; ignore a duplicate (keeps the original start).
  const { error: insErr } = await admin
    .from('quiz_attempts')
    .insert({ assignment_id: input.assignmentId, student_id: studentId })
  if (insErr && !/duplicate key|unique/i.test(insErr.message)) {
    throw new Error(`Could not start attempt: ${insErr.message}`)
  }
  const { data: att, error: attErr } = await admin
    .from('quiz_attempts')
    .select('started_at')
    .eq('assignment_id', input.assignmentId)
    .eq('student_id', studentId)
    .single()
  if (attErr || !att) throw new Error(`Could not start attempt: ${attErr?.message ?? 'no row'}`)

  let deadlineMs = new Date(att.started_at).getTime() + eff * 60_000
  if (asg.closes_at) deadlineMs = Math.min(deadlineMs, new Date(asg.closes_at).getTime())

  return {
    timed: true,
    startedAt: att.started_at,
    durationMinutes: eff,
    deadline: new Date(deadlineMs).toISOString(),
  }
}
