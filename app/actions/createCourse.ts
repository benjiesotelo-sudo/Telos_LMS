'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function createCourse(input: {
  code: string; title: string; description?: string
}): Promise<{ courseId: string }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  if (!profile || (profile.role !== 'instructor' && profile.role !== 'admin')) {
    throw new Error('Forbidden: instructor or admin required')
  }
  const admin = createAdminClient()
  const { data, error: insErr } = await admin
    .from('courses')
    .insert({ instructor_id: auth.user.id, code: input.code, title: input.title, description: input.description ?? '' })
    .select('id')
    .single()
  if (insErr || !data) throw new Error(insErr?.message ?? 'Failed to create course')
  return { courseId: data.id }
}
