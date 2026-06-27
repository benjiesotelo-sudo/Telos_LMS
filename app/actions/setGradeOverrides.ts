'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface GradeOverrideEntry {
  studentId: string
  assessmentId: string
  /**
   * Raw score to store (may exceed total_points for bonus), OR null to REMOVE the
   * override for this (student, assessment) — revert-to-auto / clear. The GradeEditor
   * sends null when the instructor clears a cell or sets it back to the auto value
   * (avoiding redundant overrides — the ≠-auto rule).
   */
  score: number | null
}

export interface SetGradeOverridesInput {
  classId: string
  entries: GradeOverrideEntry[]
}

/**
 * Batch-save grade edits spanning any number of assessments in one class. One
 * owner/admin guard, one bulk upsert (score != null), grouped deletes (score === null,
 * one delete per assessment), then a single refresh(). The editor sends only the rows
 * that CHANGED, so an empty/no-op save touches nothing.
 */
export async function setGradeOverrides(
  input: SetGradeOverridesInput,
): Promise<{ ok: true; upserted: number; deleted: number }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()

  // Verify the caller owns the class (or is admin) before mutating.
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select('instructor_id')
    .eq('id', input.classId)
    .single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  const toUpsert = input.entries.filter((e) => e.score !== null)
  const toDelete = input.entries.filter((e) => e.score === null)

  let upserted = 0
  if (toUpsert.length > 0) {
    const now = new Date().toISOString()
    const rows = toUpsert.map((e) => ({
      student_id:    e.studentId,
      assessment_id: e.assessmentId,
      class_id:      input.classId,
      score:         e.score as number,   // not null — partitioned above
      note:          '',
      instructor_id: callerId,
      updated_at:    now,
    }))
    const { error: upErr } = await admin
      .from('grade_overrides')
      .upsert(rows, { onConflict: 'student_id,assessment_id,class_id' })
    if (upErr) throw new Error(`Failed to upsert grade overrides: ${upErr.message}`)
    upserted = rows.length
  }

  let deleted = 0
  if (toDelete.length > 0) {
    // Group deletes by assessment so each is one .in('student_id', ...) call.
    const byAssessment = new Map<string, string[]>()
    for (const e of toDelete) {
      const arr = byAssessment.get(e.assessmentId) ?? []
      arr.push(e.studentId)
      byAssessment.set(e.assessmentId, arr)
    }
    for (const [assessmentId, studentIds] of byAssessment) {
      const { error: delErr } = await admin
        .from('grade_overrides')
        .delete()
        .eq('class_id', input.classId)
        .eq('assessment_id', assessmentId)
        .in('student_id', studentIds)
      if (delErr) throw new Error(`Failed to delete grade overrides: ${delErr.message}`)
      deleted += studentIds.length
    }
  }

  refresh()
  return { ok: true, upserted, deleted }
}
