'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function rejectPending(input: { studentId: string }): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const { data: target } = await admin.from('profiles').select('status').eq('id', input.studentId).single()
  if (!target) throw new Error('Student not found')
  if (target.status !== 'pending') throw new Error('Refusing to delete a non-pending account')
  // Deleting the auth user cascades to profiles + enrollments (FK on delete cascade).
  const { error: delErr } = await admin.auth.admin.deleteUser(input.studentId)
  if (delErr) throw new Error(delErr.message)
  return { ok: true }
}
