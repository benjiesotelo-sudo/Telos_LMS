'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCanManage } from '@/app/actions/_pendingAuth'
import { refresh } from 'next/cache'

export async function approvePending(input: { studentId: string; classId?: string }): Promise<{ ok: true }> {
  const { userId, isAdmin } = await assertCanManage(input.studentId)
  const admin = createAdminClient()

  // FIX 3: guard — target must be a pending student; prevents re-activating arbitrary accounts.
  const { data: target, error: targetErr } = await admin.from('profiles').select('role, status').eq('id', input.studentId).single()
  if (targetErr) throw new Error(`Could not load the student: ${targetErr.message}`)
  if (!target || target.role !== 'student' || target.status !== 'pending') throw new Error('Not a pending student')

  if (input.classId) {
    const { data: cls, error: clsErr } = await admin.from('classes').select('instructor_id').eq('id', input.classId).single()
    if (clsErr || !cls) throw new Error('Class not found')
    if (!isAdmin && cls.instructor_id !== userId) throw new Error('Not your class')
  }
  const { error: actErr } = await admin.from('profiles').update({ status: 'active', join_reason: null }).eq('id', input.studentId)
  if (actErr) throw new Error(`Could not activate the account: ${actErr.message}`)
  if (input.classId) {
    const { error: upErr } = await admin.from('enrollments').upsert(
      { student_id: input.studentId, class_id: input.classId, status: 'active' },
      { onConflict: 'student_id,class_id' },
    )
    if (upErr) throw new Error(`Could not enroll the student: ${upErr.message}`)
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
