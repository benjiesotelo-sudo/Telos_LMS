'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const PERIODS = ['1st Semester', '2nd Semester', 'Midyear', 'Special Course']

export async function createClass(input: {
  courseId: string; period: string; sectionLabel: string; pic?: string
}): Promise<{ classId: string }> {
  if (!PERIODS.includes(input.period)) throw new Error('Invalid period')
  if (!input.sectionLabel.trim()) throw new Error('Section label required')
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const { data: course } = await admin.from('courses').select('id, instructor_id').eq('id', input.courseId).single()
  if (!course) throw new Error('Course not found')
  if (!isAdmin && course.instructor_id !== auth.user.id) throw new Error('Not the course owner')

  const { data, error: insErr } = await admin
    .from('classes')
    .insert({
      instructor_id: course.instructor_id,
      course_id: input.courseId,
      period: input.period,
      section_label: input.sectionLabel.trim(),
      pic: input.pic?.trim() ?? '',
    })
    .select('id')
    .single()
  if (insErr || !data) throw new Error(insErr?.message ?? 'Failed to create class')
  return { classId: data.id }
}
