'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function revokeEnrollLink(input: { id: string }): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  const { data: link } = await admin.from('enroll_links').select('id, instructor_id').eq('id', input.id).single()
  if (!link) throw new Error('Link not found')
  if (!isAdmin && link.instructor_id !== auth.user.id) throw new Error('Not the link owner')
  const { error: upErr } = await admin.from('enroll_links').update({ revoked_at: new Date().toISOString() }).eq('id', input.id)
  if (upErr) throw new Error(upErr.message)
  return { ok: true }
}
