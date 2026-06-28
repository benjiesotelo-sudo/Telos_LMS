'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface RemovalRequest {
  id: string
  classId: string
  classLabel: string
  studentId: string
  studentName: string
  studentNumber: string | null
  requestedByName: string | null
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

async function authed() {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  return { id: auth.user.id, role: caller?.role ?? 'student' }
}

/** Instructor (class owner) or admin files a reason-gated removal request. */
export async function requestStudentRemoval(input: {
  classId: string
  studentId: string
  reason: string
}): Promise<{ ok: true }> {
  const caller = await authed()
  if (caller.role !== 'instructor' && caller.role !== 'admin') throw new Error('Forbidden')
  const reason = input.reason.trim()
  if (reason.length < 3) throw new Error('Please give a reason for the removal.')

  const admin = createAdminClient()
  const { data: cls, error: clsErr } = await admin.from('classes').select('instructor_id').eq('id', input.classId).single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (caller.role !== 'admin' && cls.instructor_id !== caller.id) throw new Error('Not the class owner')

  // Block a second pending request for the same student+class.
  const { data: existing } = await admin
    .from('enrollment_removal_requests')
    .select('id')
    .eq('class_id', input.classId)
    .eq('student_id', input.studentId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) throw new Error('A removal request for this student is already pending.')

  const { error } = await admin.from('enrollment_removal_requests').insert({
    class_id: input.classId,
    student_id: input.studentId,
    requested_by: caller.id,
    reason,
    status: 'pending',
  })
  if (error) throw new Error(`Failed to file request: ${error.message}`)
  refresh()
  return { ok: true }
}

/** Admin: all pending removal requests with names, for the review panel. */
export async function listRemovalRequests(): Promise<RemovalRequest[]> {
  const caller = await authed()
  if (caller.role !== 'admin') throw new Error('Forbidden')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('enrollment_removal_requests')
    .select('id, class_id, student_id, requested_by, reason, status, created_at, class:class_id(section_label, course:course_id(code))')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load requests: ${error.message}`)

  const personIds = [
    ...new Set((data ?? []).flatMap((r: any) => [r.student_id, r.requested_by]).filter(Boolean)),
  ]
  const byId = new Map<string, { full_name: string; student_number: string | null }>()
  if (personIds.length) {
    const { data: profs } = await admin.from('profiles').select('id, full_name, student_number').in('id', personIds)
    for (const p of profs ?? []) byId.set(p.id as string, { full_name: (p.full_name as string) ?? '', student_number: (p.student_number as string) ?? null })
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    classId: r.class_id,
    classLabel: `${r.class?.course?.code ?? '—'} - ${r.class?.section_label ?? '—'}`,
    studentId: r.student_id,
    studentName: byId.get(r.student_id)?.full_name ?? '—',
    studentNumber: byId.get(r.student_id)?.student_number ?? null,
    requestedByName: r.requested_by ? byId.get(r.requested_by)?.full_name ?? null : null,
    reason: r.reason,
    status: r.status,
    createdAt: r.created_at,
  }))
}

/** Instructor/admin: requests for one class (so the instructor sees status). */
export async function getClassRemovalRequests(input: { classId: string }): Promise<
  { studentId: string; status: 'pending' | 'approved' | 'rejected'; reason: string }[]
> {
  const caller = await authed()
  const admin = createAdminClient()
  const { data: cls } = await admin.from('classes').select('instructor_id').eq('id', input.classId).single()
  if (!cls) throw new Error('Class not found')
  if (caller.role !== 'admin' && cls.instructor_id !== caller.id) throw new Error('Forbidden')

  const { data } = await admin
    .from('enrollment_removal_requests')
    .select('student_id, status, reason')
    .eq('class_id', input.classId)
  return (data ?? []).map((r: any) => ({ studentId: r.student_id, status: r.status, reason: r.reason }))
}

async function review(requestId: string, decision: 'approved' | 'rejected') {
  const caller = await authed()
  if (caller.role !== 'admin') throw new Error('Forbidden')
  const admin = createAdminClient()

  const { data: req, error: reqErr } = await admin
    .from('enrollment_removal_requests')
    .select('id, class_id, student_id, status')
    .eq('id', requestId)
    .single()
  if (reqErr || !req) throw new Error('Request not found')
  if (req.status !== 'pending') throw new Error('This request was already reviewed.')

  if (decision === 'approved') {
    const { error: delErr } = await admin
      .from('enrollments')
      .delete()
      .eq('class_id', req.class_id)
      .eq('student_id', req.student_id)
    if (delErr) throw new Error(`Failed to remove enrollment: ${delErr.message}`)
  }

  const { error: updErr } = await admin
    .from('enrollment_removal_requests')
    .update({ status: decision, reviewed_by: caller.id, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)
  if (updErr) throw new Error(`Failed to update request: ${updErr.message}`)
  refresh()
  return { ok: true as const }
}

/** Admin approves → the student's enrollment is deleted. */
export async function approveRemoval(input: { requestId: string }) {
  return review(input.requestId, 'approved')
}
/** Admin rejects → enrollment kept. */
export async function rejectRemoval(input: { requestId: string }) {
  return review(input.requestId, 'rejected')
}
