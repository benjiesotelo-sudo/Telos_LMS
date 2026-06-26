'use server'
import { createAdminClient } from '@/lib/supabase/server'

export async function registerViaLink(input: {
  token: string; fullName: string; email: string; password: string
  studentNumber: string; classId?: string
}): Promise<{ ok: true }> {
  const admin = createAdminClient()

  // 1) Validate the link.
  const { data: link, error: linkErr } = await admin
    .from('enroll_links')
    .select('token, kind, class_id, expires_at, revoked_at')
    .eq('token', input.token)
    .single()
  if (linkErr || !link) throw new Error('Invalid registration link')
  if (link.revoked_at) throw new Error('This registration link was revoked')
  if (new Date(link.expires_at).getTime() <= Date.now()) throw new Error('This registration link has expired')

  // 2) Duplicate guard — field-specific.
  const email = input.email.trim().toLowerCase()
  const sn = input.studentNumber.trim()
  const { data: byEmail } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (byEmail) throw new Error(`This email (${email}) is already registered`)
  if (sn) {
    const { data: bySn } = await admin.from('profiles').select('id').eq('student_number', sn).maybeSingle()
    if (bySn) throw new Error(`Student number ${sn} is already registered`)
  }

  // 3) Resolve the target class (class link → its class; general → caller's choice).
  const classId = link.kind === 'class' ? link.class_id : (input.classId ?? null)

  // 4) Create the auth user — role forced to student, status pending.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { role: 'student', status: 'pending', full_name: input.fullName, student_number: sn },
  })
  if (createErr || !created.user) throw new Error(createErr?.message ?? 'Failed to create account')

  // 5) Pending enrollment only if a class is known.
  if (classId) {
    const { error: enrErr } = await admin
      .from('enrollments')
      .insert({ student_id: created.user.id, class_id: classId, status: 'pending' })
    if (enrErr) throw new Error(enrErr.message)
  }
  return { ok: true }
}
