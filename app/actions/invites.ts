'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface UserSearchResult {
  id: string
  fullName: string
  email: string
  studentNumber: string | null
}

export interface ClassInvite {
  classId: string
  code: string
  title: string
  sectionLabel: string
  period: string | null
  invitedByName: string | null
}

async function authed() {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  return { id: auth.user.id, role: caller?.role ?? 'student' }
}

async function assertOwnsClass(admin: ReturnType<typeof createAdminClient>, classId: string, callerId: string, isAdmin: boolean) {
  const { data: cls, error } = await admin.from('classes').select('instructor_id').eq('id', classId).single()
  if (error || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')
}

/** Search existing STUDENT accounts by name, email, or student number (instructor/admin only). */
export async function searchStudents(input: { query: string }): Promise<UserSearchResult[]> {
  const caller = await authed()
  if (caller.role !== 'instructor' && caller.role !== 'admin') throw new Error('Forbidden')
  const q = input.query.trim()
  if (q.length < 2) return []

  const admin = createAdminClient()
  const like = `%${q}%`
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email, student_number, role')
    .eq('role', 'student')
    .or(`full_name.ilike.${like},email.ilike.${like},student_number.ilike.${like}`)
    .limit(10)
  if (error) throw new Error(`Search failed: ${error.message}`)
  return (data ?? []).map((p: any) => ({
    id: p.id,
    fullName: p.full_name ?? '',
    email: p.email ?? '',
    studentNumber: p.student_number ?? null,
  }))
}

/** Invite an existing student into a class (status='invited'). Blocks duplicates. */
export async function inviteToClass(input: { classId: string; studentId: string }): Promise<{ ok: true }> {
  const caller = await authed()
  if (caller.role !== 'instructor' && caller.role !== 'admin') throw new Error('Forbidden')
  const admin = createAdminClient()
  await assertOwnsClass(admin, input.classId, caller.id, caller.role === 'admin')

  const { data: existing } = await admin
    .from('enrollments')
    .select('id, status')
    .eq('class_id', input.classId)
    .eq('student_id', input.studentId)
    .maybeSingle()
  if (existing) {
    throw new Error(existing.status === 'invited' ? 'Already invited.' : 'Student is already in this class.')
  }

  const { error } = await admin.from('enrollments').insert({
    class_id: input.classId,
    student_id: input.studentId,
    status: 'invited',
    invited_by: caller.id,
    invited_at: new Date().toISOString(),
  })
  if (error) throw new Error(`Failed to invite: ${error.message}`)
  refresh()
  return { ok: true }
}

/** The caller-student's pending class invitations. */
export async function getMyInvites(): Promise<ClassInvite[]> {
  const caller = await authed()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('enrollments')
    .select('class_id, invited_by, class:class_id(section_label, period, course:course_id(code, title))')
    .eq('student_id', caller.id)
    .eq('status', 'invited')
  if (error) throw new Error(`Failed to load invites: ${error.message}`)

  const inviterIds = [...new Set((data ?? []).map((r: any) => r.invited_by).filter(Boolean))]
  const nameById = new Map<string, string>()
  if (inviterIds.length) {
    const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', inviterIds)
    for (const p of profs ?? []) nameById.set(p.id as string, (p.full_name as string) ?? '')
  }

  return (data ?? []).map((r: any) => ({
    classId: r.class_id,
    code: r.class?.course?.code ?? '—',
    title: r.class?.course?.title ?? '',
    sectionLabel: r.class?.section_label ?? '—',
    period: r.class?.period ?? null,
    invitedByName: r.invited_by ? nameById.get(r.invited_by) ?? null : null,
  }))
}

/** Student accepts an invite → status becomes 'active'. */
export async function acceptInvite(input: { classId: string }): Promise<{ ok: true }> {
  const caller = await authed()
  const admin = createAdminClient()
  const { error } = await admin
    .from('enrollments')
    .update({ status: 'active' })
    .eq('class_id', input.classId)
    .eq('student_id', caller.id)
    .eq('status', 'invited')
  if (error) throw new Error(`Failed to accept: ${error.message}`)
  refresh()
  return { ok: true }
}

/** Student declines an invite → the invited row is deleted. */
export async function declineInvite(input: { classId: string }): Promise<{ ok: true }> {
  const caller = await authed()
  const admin = createAdminClient()
  const { error } = await admin
    .from('enrollments')
    .delete()
    .eq('class_id', input.classId)
    .eq('student_id', caller.id)
    .eq('status', 'invited')
  if (error) throw new Error(`Failed to decline: ${error.message}`)
  refresh()
  return { ok: true }
}
