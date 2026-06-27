'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface DeleteGradeOverrideInput {
  studentId: string
  assessmentId: string
  classId: string
}

/**
 * Remove a single grade override (the per-row "↺ revert" in the GradeEditor).
 * After deletion the cell falls back to the student's auto-graded submission
 * (or blank for a manual/ungraded item). Owner/admin-guarded.
 *
 * Deleting a non-existent override is a no-op success — the desired end state
 * (no override) is reached either way.
 */
export async function deleteGradeOverride(
  input: DeleteGradeOverrideInput,
): Promise<{ ok: true }> {
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

  const { error: delErr } = await admin
    .from('grade_overrides')
    .delete()
    .eq('student_id', input.studentId)
    .eq('assessment_id', input.assessmentId)
    .eq('class_id', input.classId)
  if (delErr) throw new Error(`Failed to delete grade override: ${delErr.message}`)

  refresh()
  return { ok: true }
}
