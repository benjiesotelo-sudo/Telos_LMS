'use server'

import { createAdminClient } from '@/lib/supabase/server'

interface AcceptInviteInput {
  token: string
  password: string
}

export async function acceptInvite(input: AcceptInviteInput): Promise<{ ok: true }> {
  const admin = createAdminClient()

  // 1) Load + validate the invite: must exist, be unconsumed, be unexpired.
  const { data: invite, error: inviteErr } = await admin
    .from('invites')
    .select('token, email, course_id, period_id, full_name, student_number, expires_at, consumed_at')
    .eq('token', input.token)
    .single()
  if (inviteErr || !invite) throw new Error('Invalid invite token')
  if (invite.consumed_at) throw new Error('Invite already used')
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new Error('Invite expired')
  }

  // 2) Create the auth user; the 0001 trigger auto-provisions the profile
  //    from user_metadata (role student, status active, email, full_name, student_number).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: invite.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: 'student',
      status: 'active',
      full_name: invite.full_name,
      student_number: invite.student_number ?? '',
    },
  })
  if (createErr || !created.user) {
    throw new Error(createErr?.message ?? 'Failed to create user')
  }
  const studentId = created.user.id

  // 3) Insert the enrollment for this course + period.
  const { error: enrollErr } = await admin.from('enrollments').insert({
    student_id: studentId,
    course_id: invite.course_id,
    period_id: invite.period_id,
  })
  if (enrollErr) throw new Error(enrollErr.message)

  // 4) Consume the token (single-use). Guard on consumed_at IS NULL so a
  //    concurrent second accept cannot also flip it.
  const { data: consumed, error: consumeErr } = await admin
    .from('invites')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token', input.token)
    .is('consumed_at', null)
    .select('token')
  if (consumeErr) throw new Error(consumeErr.message)
  if (!consumed || consumed.length === 0) throw new Error('Invite already used')

  return { ok: true }
}
