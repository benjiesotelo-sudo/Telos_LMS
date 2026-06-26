// Shared authorization helper for pending-registrant actions.
// Normal module (NOT a 'use server' action) — just exports a function.
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Asserts the current caller may manage the given pending student:
 * caller must be an admin, OR an instructor who instructs the student
 * (shares a class) OR the student is not yet placed in any class.
 *
 * Returns the resolved caller identity so callers can reuse it for
 * further ownership checks (e.g. validating a target classId).
 */
export async function assertCanManage(studentId: string): Promise<{ userId: string; isAdmin: boolean }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')
  if (isAdmin) return { userId: auth.user.id, isAdmin }
  // instructor: must instruct this student (share a class) OR student has no class yet
  const admin = createAdminClient()
  const { data: enr } = await admin
    .from('enrollments')
    .select('class_id, classes:class_id(instructor_id)')
    .eq('student_id', studentId)
  const owns = (enr ?? []).some((e: any) => e.classes?.instructor_id === auth.user!.id)
  const unplaced = (enr ?? []).length === 0
  if (!owns && !unplaced) throw new Error('Not your student')
  return { userId: auth.user.id, isAdmin }
}
