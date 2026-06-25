'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

interface EnrollStudentInput {
  courseId: string
  periodId: string
  email: string
  fullName: string
  studentNumber?: string
}

export async function enrollStudent(
  input: EnrollStudentInput,
): Promise<{ inviteUrl: string }> {
  // Caller must be a signed-in instructor (or admin) who owns the course.
  const supabase = await createClient()
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || (profile.role !== 'instructor' && profile.role !== 'admin')) {
    throw new Error('Forbidden: instructor or admin required')
  }

  const admin = createAdminClient()

  // Ownership check (admin client; RLS-independent, explicit).
  const { data: course } = await admin
    .from('courses')
    .select('id, instructor_id')
    .eq('id', input.courseId)
    .single()
  if (!course) throw new Error('Course not found')
  if (profile.role !== 'admin' && course.instructor_id !== user.id) {
    throw new Error('Forbidden: not the course owner')
  }

  const { data: invite, error: insErr } = await admin
    .from('invites')
    .insert({
      email: input.email,
      course_id: input.courseId,
      period_id: input.periodId,
      full_name: input.fullName,
      student_number: input.studentNumber ?? null,
    })
    .select('token')
    .single()
  if (insErr || !invite) throw new Error(insErr?.message ?? 'Failed to create invite')

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return { inviteUrl: `${base}/invite/${invite.token}` }
}
