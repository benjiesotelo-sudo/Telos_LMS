'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface SetGradeOverrideInput {
  studentId: string
  assessmentId: string
  classId: string
  score: number       // may exceed 100 (bonus)
  note?: string
}

export async function setGradeOverride(input: SetGradeOverrideInput): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = caller?.role === 'admin'

  const admin = createAdminClient()

  // Verify the caller owns the class (or is admin)
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select('instructor_id')
    .eq('id', input.classId)
    .single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  // UPSERT on the unique key (student_id, assessment_id, class_id)
  // score may exceed 100 — do NOT clamp
  const { error: upsertErr } = await admin
    .from('grade_overrides')
    .upsert(
      {
        student_id: input.studentId,
        assessment_id: input.assessmentId,
        class_id: input.classId,
        score: input.score,
        note: input.note ?? '',
        instructor_id: callerId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,assessment_id,class_id' }
    )
  if (upsertErr) throw new Error(`Failed to upsert grade override: ${upsertErr.message}`)

  refresh()
  return { ok: true }
}
