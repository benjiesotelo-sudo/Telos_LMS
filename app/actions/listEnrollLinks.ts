'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { EnrollLinkRow } from '@/lib/types'

export async function listEnrollLinks(): Promise<EnrollLinkRow[]> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!profile || (profile.role !== 'instructor' && !isAdmin)) throw new Error('Forbidden')

  const admin = createAdminClient()
  let q = admin.from('enroll_links')
    .select('id, token, kind, class_id, expires_at, created_at, classes:class_id(section_label, courses:course_id(code))')
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (!isAdmin) q = q.eq('instructor_id', auth.user.id)
  const { data, error: qErr } = await q
  if (qErr) throw new Error(qErr.message)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return (data ?? []).map((r: any) => ({
    id: r.id,
    token: r.token,
    url: `${base}/register/${r.token}`,
    kind: r.kind,
    classId: r.class_id,
    className: r.classes ? `${r.classes.courses?.code ?? ''} - ${r.classes.section_label}` : null,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }))
}
