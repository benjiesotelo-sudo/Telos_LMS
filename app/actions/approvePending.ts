'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCanManage } from '@/app/actions/_pendingAuth'
import { refresh } from 'next/cache'

export async function approvePending(input: { studentId: string; classId?: string }): Promise<{ ok: true }> {
  const { userId, isAdmin } = await assertCanManage(input.studentId)
  const admin = createAdminClient()

  // FIX 3: guard — target must be a pending student; prevents re-activating arbitrary accounts.
  const { data: target } = await admin.from('profiles').select('role, status').eq('id', input.studentId).single()
  if (!target || target.role !== 'student' || target.status !== 'pending') throw new Error('Not a pending student')

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

  // FIX 4: scope enrollment activation to the caller's own classes (tenant isolation).
  if (isAdmin) {
    await admin.from('enrollments').update({ status: 'active' }).eq('student_id', input.studentId)
  } else {
    const { data: myClasses } = await admin.from('classes').select('id').eq('instructor_id', userId)
    const myClassIds = (myClasses ?? []).map((c: any) => c.id)
    if (myClassIds.length > 0) {
      await admin
        .from('enrollments')
        .update({ status: 'active' })
        .eq('student_id', input.studentId)
        .in('class_id', myClassIds)
    }
  }
  refresh()
  return { ok: true }
}
