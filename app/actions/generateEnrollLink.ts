'use server'
import { refresh } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function generateEnrollLink(input: {
  kind: 'class' | 'general'; classId?: string; days?: number
}): Promise<{ url: string; token: string; expiresAt: string }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  if (input.kind === 'class') {
    if (!input.classId) throw new Error('classId required for a class link')
    const { data: cls } = await admin.from('classes').select('id, instructor_id').eq('id', input.classId).single()
    if (!cls) throw new Error('Class not found')
    if (!isAdmin && cls.instructor_id !== auth.user.id) throw new Error('Not the class owner')
  }
  const days = input.days ?? (input.kind === 'class' ? 7 : 2)
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString()

  const { data, error: insErr } = await admin
    .from('enroll_links')
    .insert({
      instructor_id: auth.user.id,
      kind: input.kind,
      class_id: input.kind === 'class' ? input.classId : null,
      expires_at: expiresAt,
    })
    .select('token, expires_at')
    .single()
  if (insErr || !data) throw new Error(insErr?.message ?? 'Failed to create link')

  refresh()
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return { url: `${base}/register/${data.token}`, token: data.token, expiresAt: data.expires_at }
}
