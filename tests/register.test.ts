import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'
import { registerViaLink } from '@/app/actions/registerViaLink'
import { approvePending } from '@/app/actions/approvePending'
import { rejectPending } from '@/app/actions/rejectPending'

const PW = 'Test_pw_123!'
const tag = `reg-${Date.now()}`

async function instructorWithClassLink() {
  const instr = await createUser({ role: 'instructor', email: `${tag}-${Math.round(performance.now())}@x.com`, password: PW, fullName: 'I' })
  const courseId = (await seedCourse({ instructorId: instr.id, code: `${tag}-${Math.round(performance.now())}`, title: 'C' })).id
  const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
  await setTestUser(instr.email, PW)
  const link = await generateEnrollLink({ kind: 'class', classId })
  return { instr, classId, token: link.token }
}

describe('registerViaLink', () => {
  it('creates a pending student + pending enrollment, role forced to student', async () => {
    const { classId, token } = await instructorWithClassLink()
    const email = `${tag}-stud@x.com`
    await registerViaLink({ token, fullName: 'Stud', email, password: PW, studentNumber: 'SN-1', classId: 'attacker-ignored' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id, role, status').eq('email', email).single()
    expect(prof?.role).toBe('student')
    expect(prof?.status).toBe('pending')
    const { data: enr } = await admin.from('enrollments').select('status, class_id').eq('student_id', prof!.id).single()
    expect(enr?.status).toBe('pending')
    expect(enr?.class_id).toBe(classId)
  })

  it('blocks a duplicate email with a field-specific message', async () => {
    const { token } = await instructorWithClassLink()
    const email = `${tag}-dupe@x.com`
    await registerViaLink({ token, fullName: 'A', email, password: PW, studentNumber: 'SN-A' })
    const { token: token2 } = await instructorWithClassLink()
    await expect(registerViaLink({ token: token2, fullName: 'B', email, password: PW, studentNumber: 'SN-B' }))
      .rejects.toThrow(/email .* already registered/i)
  })

  it('blocks a duplicate student number with a field-specific message', async () => {
    const { token } = await instructorWithClassLink()
    await registerViaLink({ token, fullName: 'A', email: `${tag}-sn1@x.com`, password: PW, studentNumber: 'SN-DUP' })
    const { token: token2 } = await instructorWithClassLink()
    await expect(registerViaLink({ token: token2, fullName: 'B', email: `${tag}-sn2@x.com`, password: PW, studentNumber: 'SN-DUP' }))
      .rejects.toThrow(/student number .* already registered/i)
  })

  it('rejects an expired link', async () => {
    const { token } = await instructorWithClassLink()
    const admin = createAdminClient()
    await admin.from('enroll_links').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('token', token)
    await expect(registerViaLink({ token, fullName: 'X', email: `${tag}-exp@x.com`, password: PW, studentNumber: 'SN-X' }))
      .rejects.toThrow(/expired/i)
  })

  it('rejects a revoked link', async () => {
    const { token } = await instructorWithClassLink()
    const admin = createAdminClient()
    await admin.from('enroll_links').update({ revoked_at: new Date().toISOString() }).eq('token', token)
    await expect(registerViaLink({ token, fullName: 'R', email: `${tag}-rev@x.com`, password: PW, studentNumber: 'SN-R' }))
      .rejects.toThrow(/revoked/i)
  })

  it('rejects an empty student number', async () => {
    const { token } = await instructorWithClassLink()
    await expect(registerViaLink({ token, fullName: 'E', email: `${tag}-empty@x.com`, password: PW, studentNumber: '' }))
      .rejects.toThrow(/student number is required/i)
  })
})

describe('approve / reject pending', () => {
  it('approve activates the profile and enrollment', async () => {
    const { instr, classId, token } = await instructorWithClassLink()
    const email = `${tag}-appr@x.com`
    await registerViaLink({ token, fullName: 'P', email, password: PW, studentNumber: 'SN-APPR' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
    await setTestUser(instr.email, PW)
    await approvePending({ studentId: prof!.id })
    const { data: after } = await admin.from('profiles').select('status').eq('id', prof!.id).single()
    expect(after?.status).toBe('active')
    const { data: enr } = await admin.from('enrollments').select('status').eq('student_id', prof!.id).single()
    expect(enr?.status).toBe('active')
  })

  it('reject removes the pending account', async () => {
    const { instr, token } = await instructorWithClassLink()
    const email = `${tag}-rej@x.com`
    await registerViaLink({ token, fullName: 'R', email, password: PW, studentNumber: 'SN-REJ' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
    await setTestUser(instr.email, PW)
    await rejectPending({ studentId: prof!.id })
    const { data: gone } = await admin.from('profiles').select('id').eq('id', prof!.id).maybeSingle()
    expect(gone).toBeNull()
  })

  it('reject refuses a student the caller does not instruct (tenant isolation)', async () => {
    const { token } = await instructorWithClassLink()
    const email = `${tag}-rej-x@x.com`
    await registerViaLink({ token, fullName: 'X', email, password: PW, studentNumber: 'SN-REJ-X' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
    // A different instructor (B) who does not instruct this student.
    const instrB = await createUser({ role: 'instructor', email: `${tag}-B-${Math.round(performance.now())}@x.com`, password: PW, fullName: 'B' })
    await setTestUser(instrB.email, PW)
    await expect(rejectPending({ studentId: prof!.id })).rejects.toThrow()
    const { data: stillThere } = await admin.from('profiles').select('id').eq('id', prof!.id).maybeSingle()
    expect(stillThere?.id).toBe(prof!.id)
  })
})
