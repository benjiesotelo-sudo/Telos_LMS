'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCanManage } from '@/app/actions/_pendingAuth'

export async function approvePending(input: { studentId: string; classId?: string }): Promise<{ ok: true }> {
  const { userId, isAdmin } = await assertCanManage(input.studentId)
  const admin = createAdminClient()
  if (input.classId) {
    const { data: cls } = await admin.from('classes').select('instructor_id').eq('id', input.classId).single()
    if (!isAdmin && cls?.instructor_id !== userId) throw new Error('Not your class')
  }
  await admin.from('profiles').update({ status: 'active' }).eq('id', input.studentId)
  if (input.classId) {
    await admin.from('enrollments').upsert(
      { student_id: input.studentId, class_id: input.classId, status: 'active' },
      { onConflict: 'student_id,class_id' },
    )
  }
  await admin.from('enrollments').update({ status: 'active' }).eq('student_id', input.studentId)
  return { ok: true }
}
