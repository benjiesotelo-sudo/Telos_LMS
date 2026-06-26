'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCanManage } from '@/app/actions/_pendingAuth'
import { refresh } from 'next/cache'

export async function rejectPending(input: { studentId: string }): Promise<{ ok: true }> {
  // Caller must instruct this student (own a class they're in) or be admin.
  await assertCanManage(input.studentId)

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('status').eq('id', input.studentId).single()
  if (!target) throw new Error('Student not found')
  if (target.status !== 'pending') throw new Error('Refusing to delete a non-pending account')
  // Deleting the auth user cascades to profiles + enrollments (FK on delete cascade).
  const { error: delErr } = await admin.auth.admin.deleteUser(input.studentId)
  if (delErr) throw new Error(delErr.message)
  refresh()
  return { ok: true }
}
