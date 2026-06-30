// tests/password-reset-requests.test.ts — student requests a reset (chooses a new password),
// admin approves → the chosen password is applied and the account activated. Email-free.
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser } from '@/tests/helpers/fixtures'
import { setTestUser, clearTestUser, signInAs } from '@/tests/helpers/auth'
import {
  submitPasswordResetRequest,
  listPasswordResetRequests,
  approvePasswordReset,
  rejectPasswordReset,
} from '@/app/actions/passwordResetRequests'

afterEach(clearTestUser)

const PW = 'Req_pw_123!'
const CHOSEN_PW = 'Chosen_pw_456!'
const SECOND_PW = 'Second_pw_789!'
const tag = `pwreq-${Date.now()}`

let adminEmail: string
let studentId: string
let studentEmail: string
const studentSN = `${tag}-SN`

beforeAll(async () => {
  const adm = await createUser({ role: 'admin', email: `${tag}-admin@x.com`, password: PW, fullName: 'Req Admin' })
  adminEmail = adm.email
  const stu = await createUser({ role: 'student', email: `${tag}-stu@x.com`, password: PW, fullName: 'Req Stu', studentNumber: studentSN })
  studentId = stu.id
  studentEmail = stu.email
  // Pending (locked out) — the case this flow rescues.
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'pending' }).eq('id', studentId)
})

async function pendingRowFor(profileId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('password_reset_requests')
    .select('id, new_password, status')
    .eq('profile_id', profileId)
    .eq('status', 'pending')
    .maybeSingle()
  return data
}

describe('submitPasswordResetRequest (unauthenticated student)', () => {
  it('rejects a too-short password', async () => {
    await expect(
      submitPasswordResetRequest({ email: studentEmail, studentNumber: studentSN, newPassword: 'abc' }),
    ).rejects.toThrow(/at least 6/i)
  })

  it('no request created when email/student# do not match (anti-enumeration, silent ok)', async () => {
    const res = await submitPasswordResetRequest({ email: 'nobody@nowhere.test', studentNumber: 'XXXX', newPassword: CHOSEN_PW })
    expect(res.ok).toBe(true)
    expect(await pendingRowFor(studentId)).toBeNull()
  })

  it('no request created when the student number is wrong (both must match)', async () => {
    const res = await submitPasswordResetRequest({ email: studentEmail, studentNumber: 'WRONG-NUMBER', newPassword: CHOSEN_PW })
    expect(res.ok).toBe(true)
    expect(await pendingRowFor(studentId)).toBeNull()
  })

  it('creates a pending request when email + student# match a student', async () => {
    const res = await submitPasswordResetRequest({ email: studentEmail, studentNumber: studentSN, newPassword: CHOSEN_PW })
    expect(res.ok).toBe(true)
    const row = await pendingRowFor(studentId)
    expect(row).toBeTruthy()
    expect(row!.new_password).toBe(CHOSEN_PW)
  })

  it('a re-request replaces the existing pending request (one open per student)', async () => {
    await submitPasswordResetRequest({ email: studentEmail, studentNumber: studentSN, newPassword: SECOND_PW })
    const admin = createAdminClient()
    const { data } = await admin
      .from('password_reset_requests')
      .select('id')
      .eq('profile_id', studentId)
      .eq('status', 'pending')
    expect(data?.length).toBe(1)
    const row = await pendingRowFor(studentId)
    expect(row!.new_password).toBe(SECOND_PW)
  })

  it('does not create a request for a suspended student (deliberate lockout)', async () => {
    const susp = await createUser({ role: 'student', email: `${tag}-susp@x.com`, password: PW, fullName: 'Susp Req', studentNumber: `${tag}-SN-SUSP` })
    const admin = createAdminClient()
    await admin.from('profiles').update({ status: 'suspended' }).eq('id', susp.id)

    const res = await submitPasswordResetRequest({ email: susp.email, studentNumber: `${tag}-SN-SUSP`, newPassword: CHOSEN_PW })
    expect(res.ok).toBe(true)
    const { data } = await admin.from('password_reset_requests').select('id').eq('profile_id', susp.id)
    expect(data?.length ?? 0).toBe(0)
  })
})

describe('admin review', () => {
  it('a non-admin cannot list requests', async () => {
    await setTestUser(studentEmail, PW) // pending students can still authenticate at the auth layer
    await expect(listPasswordResetRequests()).rejects.toThrow(/forbidden/i)
  })

  it('admin approves → chosen password works, account activated, secret cleared', async () => {
    await setTestUser(adminEmail, PW)
    const reqs = await listPasswordResetRequests()
    const mine = reqs.find((r) => r.profileId === studentId)!
    expect(mine).toBeTruthy()
    expect(mine.fullName).toBe('Req Stu')
    expect(mine.studentNumber).toBe(studentSN)

    await approvePasswordReset({ requestId: mine.id })

    // The chosen (second) password now authenticates; the original one no longer works.
    const { accessToken } = await signInAs(studentEmail, SECOND_PW)
    expect(accessToken).toBeTruthy()
    await expect(signInAs(studentEmail, PW)).rejects.toThrow()

    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('status').eq('id', studentId).single()
    expect(prof?.status).toBe('active')
    const { data: req } = await admin
      .from('password_reset_requests')
      .select('status, new_password')
      .eq('id', mine.id)
      .single()
    expect(req?.status).toBe('approved')
    expect(req?.new_password).toBeNull()
  })

  it('reject clears the secret and does not change the password', async () => {
    // New request from the (now active) student.
    await submitPasswordResetRequest({ email: studentEmail, studentNumber: studentSN, newPassword: 'Reject_pw_000!' })
    await setTestUser(adminEmail, PW)
    const reqs = await listPasswordResetRequests()
    const r = reqs.find((x) => x.profileId === studentId)!
    await rejectPasswordReset({ requestId: r.id })

    // The rejected password must NOT work; the previously-approved one still does.
    await expect(signInAs(studentEmail, 'Reject_pw_000!')).rejects.toThrow()
    const { accessToken } = await signInAs(studentEmail, SECOND_PW)
    expect(accessToken).toBeTruthy()

    const admin = createAdminClient()
    const { data: req } = await admin
      .from('password_reset_requests')
      .select('status, new_password')
      .eq('id', r.id)
      .single()
    expect(req?.status).toBe('rejected')
    expect(req?.new_password).toBeNull()
  })
})
