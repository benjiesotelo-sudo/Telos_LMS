'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export interface PasswordResetRequest {
  id: string
  profileId: string
  fullName: string
  email: string
  studentNumber: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

/**
 * UNAUTHENTICATED student requests a password reset (they're locked out, so they can't be
 * signed in). They identify themselves by email + student number and choose a NEW password,
 * which is held (in a service-role-only table) until an admin approves it.
 *
 * Anti-enumeration: always returns ok. A request row is created ONLY when the email AND
 * student number both match the SAME student profile — otherwise it silently no-ops, so the
 * login page never reveals which accounts exist.
 */
export async function submitPasswordResetRequest(input: {
  email: string
  studentNumber: string
  newPassword: string
}): Promise<{ ok: true }> {
  const email = input.email.trim().toLowerCase()
  const studentNumber = input.studentNumber.trim()
  if (input.newPassword.length < 6) throw new Error('Password must be at least 6 characters.')
  if (!email || !studentNumber) throw new Error('Enter your email and student number.')

  const admin = createAdminClient()
  // Identify the account by EXACT email + student number — both must match the same STUDENT
  // profile. Use .eq, NOT .ilike: emails are stored lowercased (and we lowercased the input),
  // so .ilike adds nothing but would treat %/_ in the address as live SQL wildcards.
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, status, student_number')
    .eq('email', email)
    .maybeSingle()

  if (
    profile &&
    profile.role === 'student' &&
    profile.status !== 'suspended' && // a deliberate lockout isn't undone by self-service
    (profile.student_number ?? '') === studentNumber
  ) {
    // One open request per student: drop any existing pending row, then insert the new choice.
    await admin
      .from('password_reset_requests')
      .delete()
      .eq('profile_id', profile.id)
      .eq('status', 'pending')
    const { error } = await admin.from('password_reset_requests').insert({
      profile_id: profile.id,
      new_password: input.newPassword,
      status: 'pending',
    })
    // Anti-enumeration: success/failure must NOT reveal whether the account exists. A genuine
    // insert error (e.g. a rare concurrent double-submit racing the partial unique index) is
    // logged server-side and swallowed — the caller always gets { ok: true }.
    if (error) console.error('submitPasswordResetRequest: insert failed —', error.message)
  }
  return { ok: true }
}

/** Admin guard — returns the caller's id, or throws. */
async function authedAdmin(): Promise<{ id: string }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single()
  if (!caller || caller.role !== 'admin') throw new Error('Forbidden: admin only')
  return { id: auth.user.id }
}

/** Admin: all pending password-reset requests with the student's name/email/number. */
export async function listPasswordResetRequests(): Promise<PasswordResetRequest[]> {
  await authedAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('password_reset_requests')
    .select('id, profile_id, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load requests: ${error.message}`)

  const ids = [...new Set((data ?? []).map((r: any) => r.profile_id))]
  const byId = new Map<string, { full_name: string; email: string; student_number: string | null }>()
  if (ids.length) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name, email, student_number')
      .in('id', ids)
    for (const p of profs ?? [])
      byId.set(p.id as string, {
        full_name: (p.full_name as string) ?? '',
        email: (p.email as string) ?? '',
        student_number: (p.student_number as string) ?? null,
      })
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    profileId: r.profile_id,
    fullName: byId.get(r.profile_id)?.full_name ?? '—',
    email: byId.get(r.profile_id)?.email ?? '—',
    studentNumber: byId.get(r.profile_id)?.student_number ?? null,
    status: r.status,
    createdAt: r.created_at,
  }))
}

async function review(requestId: string, decision: 'approved' | 'rejected') {
  const caller = await authedAdmin()
  const admin = createAdminClient()

  const { data: req, error: reqErr } = await admin
    .from('password_reset_requests')
    .select('id, profile_id, new_password, status')
    .eq('id', requestId)
    .single()
  if (reqErr || !req) throw new Error('Request not found')
  if (req.status !== 'pending') throw new Error('This request was already reviewed.')

  if (decision === 'approved') {
    if (!req.new_password) throw new Error('This request has no stored password.')
    // Apply the student's chosen password to their auth account.
    const { error: pwErr } = await admin.auth.admin.updateUserById(req.profile_id, {
      password: req.new_password,
    })
    if (pwErr) throw new Error(`Failed to set password: ${pwErr.message}`)
    // Restore access (same rule as adminResetPassword): activate a PENDING account so the
    // route gate no longer parks them at /holding. (A 'suspended' account is left untouched.)
    const { error: stErr } = await admin
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', req.profile_id)
      .eq('status', 'pending')
    if (stErr) throw new Error(stErr.message)
  }

  // Clear the stored secret regardless of decision, and record the review.
  const { error: updErr } = await admin
    .from('password_reset_requests')
    .update({
      status: decision,
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      new_password: null,
    })
    .eq('id', requestId)
  if (updErr) throw new Error(`Failed to update request: ${updErr.message}`)
  refresh()
  return { ok: true as const }
}

/** Admin approves → the student's chosen password is applied and their account activated. */
export async function approvePasswordReset(input: { requestId: string }) {
  return review(input.requestId, 'approved')
}
/** Admin rejects → nothing changes; the stored password is discarded. */
export async function rejectPasswordReset(input: { requestId: string }) {
  return review(input.requestId, 'rejected')
}
