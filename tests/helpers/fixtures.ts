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

export async function seedClass(input: {
  instructorId: string
  courseId: string
  period: string
  sectionLabel?: string
  pic?: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('classes')
    .insert({
      instructor_id: input.instructorId,
      course_id: input.courseId,
      period: input.period,
      section_label: input.sectionLabel ?? '1',
      pic: input.pic ?? '',
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function seedAssignment(input: {
  assessmentId: string
  classId: string
  instructorId: string
  opensAt?: string
  closesAt?: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('assignments')
    .insert({
      assessment_id: input.assessmentId,
      class_id: input.classId,
      instructor_id: input.instructorId,
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
  classId: string
}): Promise<{ id: string }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('enrollments')
    .insert({ student_id: input.studentId, class_id: input.classId })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}
