'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function assertCanManage(studentId: string) {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')
  if (isAdmin) return
  // instructor: must instruct this student (share a class) OR student has no class yet
  const admin = createAdminClient()
  const { data: enr } = await admin
    .from('enrollments')
    .select('class_id, classes:class_id(instructor_id)')
    .eq('student_id', studentId)
  const owns = (enr ?? []).some((e: any) => e.classes?.instructor_id === auth.user!.id)
  const unplaced = (enr ?? []).length === 0
  if (!owns && !unplaced) throw new Error('Not your student')
}

export async function approvePending(input: { studentId: string; classId?: string }): Promise<{ ok: true }> {
  await assertCanManage(input.studentId)
  const admin = createAdminClient()
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
