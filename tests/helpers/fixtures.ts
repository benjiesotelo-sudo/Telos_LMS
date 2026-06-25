import { createAdminClient } from '@/lib/supabase/server'

export async function createUser(input: {
  role: 'admin' | 'instructor' | 'student'
  email: string
  password: string
  fullName: string
  studentNumber?: string
}): Promise<{ id: string; email: string; password: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: input.role,
      full_name: input.fullName,
      status: 'active',
      student_number: input.studentNumber ?? null,
    },
  })
  if (error) throw error
  // The 0001 on_auth_user_created trigger inserts the matching profiles row.
  return { id: data.user.id, email: input.email, password: input.password }
}

export async function seedCourse(input: {
  instructorId: string
  code: string
  title: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('courses')
    .insert({ instructor_id: input.instructorId, code: input.code, title: input.title })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function seedPeriod(input: {
  courseId: string
  instructorId: string
  label: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('periods')
    .insert({
      course_id: input.courseId,
      instructor_id: input.instructorId,
      label: input.label,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function seedAssignment(input: {
  assessmentId: string
  courseId: string
  periodId: string
  instructorId: string
  pic?: string
  opensAt?: string
  closesAt?: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('assignments')
    .insert({
      assessment_id: input.assessmentId,
      course_id: input.courseId,
      period_id: input.periodId,
      instructor_id: input.instructorId,
      pic: input.pic ?? '',
      opens_at: input.opensAt ?? null,
      closes_at: input.closesAt ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function seedEnrollment(input: {
  studentId: string
  courseId: string
  periodId: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('enrollments')
    .insert({
      student_id: input.studentId,
      course_id: input.courseId,
      period_id: input.periodId,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}
