// tests/admin-reset-password.test.ts — admin "Reset PW" changes the password AND
// re-activates a pending account (the live-class bug: reset alone left pending students
// parked at /holding by gateRoute).
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser } from '@/tests/helpers/fixtures'
import { setTestUser, clearTestUser, signInAs } from '@/tests/helpers/auth'
import { adminResetPassword } from '@/app/actions/admin/adminResetPassword'

afterEach(clearTestUser)

const PW = 'Adm_pw_123!'
const NEW_PW = 'Adm_new_456!'
const tag = `admreset-${Date.now()}`

let adminEmail: string
let pendingStudentId: string
let pendingStudentEmail: string

beforeAll(async () => {
  const adm = await createUser({ role: 'admin', email: `${tag}-admin@x.com`, password: PW, fullName: 'Reset Admin' })
  adminEmail = adm.email
  const stu = await createUser({ role: 'student', email: `${tag}-stu@x.com`, password: PW, fullName: 'Pending Stu', studentNumber: `${tag}-SN` })
  pendingStudentId = stu.id
  pendingStudentEmail = stu.email
  // Force the student to 'pending' — the real-world locked-out case the admin tries to rescue.
  const admin = createAdminClient()
  await admin.from('profiles').update({ status: 'pending' }).eq('id', pendingStudentId)
})

describe('adminResetPassword', () => {
  it('rejects a too-short password', async () => {
    await setTestUser(adminEmail, PW)
    await expect(adminResetPassword({ id: pendingStudentId, newPassword: 'abc' })).rejects.toThrow(/at least 6/i)
  })

  it('a non-admin cannot reset', async () => {
    const other = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'Plain Instr' })
    await setTestUser(other.email, PW)
    await expect(adminResetPassword({ id: pendingStudentId, newPassword: NEW_PW })).rejects.toThrow(/admin/i)
  })

  it('changes the password AND activates a pending account (the real fix)', async () => {
    await setTestUser(adminEmail, PW)
    await adminResetPassword({ id: pendingStudentId, newPassword: NEW_PW })

    // The new password authenticates.
    const { accessToken } = await signInAs(pendingStudentEmail, NEW_PW)
    expect(accessToken).toBeTruthy()

    // Status is now active — gateRoute no longer parks them at /holding.
    const admin = createAdminClient()
    const { data } = await admin.from('profiles').select('status').eq('id', pendingStudentId).single()
    expect(data?.status).toBe('active')
  })

  it('leaves a suspended account suspended (reset does not silently un-suspend)', async () => {
    const susp = await createUser({ role: 'student', email: `${tag}-susp@x.com`, password: PW, fullName: 'Susp Stu', studentNumber: `${tag}-SN2` })
    const admin = createAdminClient()
    await admin.from('profiles').update({ status: 'suspended' }).eq('id', susp.id)

    await setTestUser(adminEmail, PW)
    await adminResetPassword({ id: susp.id, newPassword: NEW_PW })

    const { data } = await admin.from('profiles').select('status').eq('id', susp.id).single()
    expect(data?.status).toBe('suspended')
  })
})
