'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { composeFullName } from '@/lib/name'

export async function registerViaLink(input: {
  token: string
  prefix?: string
  firstName: string
  middleInitial?: string
  lastName: string
  suffix?: string
  email: string
  password: string
  studentNumber: string
  classId?: string
  /** Optional reason for joining (shown to the approver to speed approval). */
  reason?: string
}): Promise<{ ok: true }> {
  const admin = createAdminClient()

  // Validate required name parts.
  if (!input.firstName.trim()) throw new Error('First name is required')
  if (!input.lastName.trim()) throw new Error('Last name is required')

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
  if (!sn) throw new Error('Student number is required')
  const { data: byEmail, error: byEmailErr } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (byEmailErr) throw new Error('Could not verify the email — please try again')
  if (byEmail) throw new Error(`This email (${email}) is already registered`)
  const { data: bySn, error: bySnErr } = await admin.from('profiles').select('id').eq('student_number', sn).maybeSingle()
  if (bySnErr) throw new Error('Could not verify the student number — please try again')
  if (bySn) throw new Error(`Student number ${sn} is already registered`)

  // 3) Resolve the target class (class link → its class; general → caller's choice).
  const classId = link.kind === 'class' ? link.class_id : (input.classId ?? null)

  // 4) Compose full name from parts.
  const prefix = (input.prefix ?? '').trim()
  const firstName = input.firstName.trim()
  const middleInitial = (input.middleInitial ?? '').trim()
  const lastName = input.lastName.trim()
  const suffix = (input.suffix ?? '').trim()
  const full_name = composeFullName({ prefix, firstName, middleInitial, lastName, suffix })

  // 5) Create the auth user — role forced to student, status pending.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: 'student',
      status: 'pending',
      full_name,
      student_number: sn,
      prefix,
      first_name: firstName,
      middle_initial: middleInitial,
      last_name: lastName,
      suffix,
    },
  })
  if (createErr || !created.user) throw new Error(createErr?.message ?? 'Failed to create account')

  // 6) Pending enrollment only if a class is known.
  if (classId) {
    const { error: enrErr } = await admin
      .from('enrollments')
      .insert({ student_id: created.user.id, class_id: classId, status: 'pending' })
    if (enrErr) {
      await admin.auth.admin.deleteUser(created.user.id)
      throw new Error(enrErr.message)
    }
  }

  // 7) Optional join reason (shown to the approver). Best-effort — don't fail registration.
  const reason = input.reason?.trim()
  if (reason) {
    await admin.from('profiles').update({ join_reason: reason.slice(0, 500) }).eq('id', created.user.id)
  }

  return { ok: true }
}
