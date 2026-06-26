import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'
import { registerViaLink } from '@/app/actions/registerViaLink'
import { approvePending } from '@/app/actions/approvePending'
import { rejectPending } from '@/app/actions/rejectPending'
import { composeFullName } from '@/lib/name'

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
    await registerViaLink({ token, firstName: 'Stud', lastName: 'Student', email, password: PW, studentNumber: 'SN-1', classId: 'attacker-ignored' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id, role, status, full_name, first_name, last_name').eq('email', email).single()
    expect(prof?.role).toBe('student')
    expect(prof?.status).toBe('pending')
    expect(prof?.full_name).toBe(composeFullName({ firstName: 'Stud', lastName: 'Student' }))
    expect(prof?.first_name).toBe('Stud')
    expect(prof?.last_name).toBe('Student')
    const { data: enr } = await admin.from('enrollments').select('status, class_id').eq('student_id', prof!.id).single()
    expect(enr?.status).toBe('pending')
    expect(enr?.class_id).toBe(classId)
  })

  it('stores all name parts and composes full_name with prefix and suffix', async () => {
    const { token } = await instructorWithClassLink()
    const email = `${tag}-named@x.com`
    const parts = { prefix: 'Dr.', firstName: 'Maria', middleInitial: 'A', lastName: 'Santos', suffix: 'Jr.' }
    await registerViaLink({ token, ...parts, email, password: PW, studentNumber: 'SN-NAMED' })
    const admin = createAdminClient()
    const { data: prof } = await admin
      .from('profiles')
      .select('full_name, prefix, first_name, middle_initial, last_name, suffix')
      .eq('email', email)
      .single()
    expect(prof?.full_name).toBe(composeFullName(parts))
    expect(prof?.prefix).toBe('Dr.')
    expect(prof?.first_name).toBe('Maria')
    expect(prof?.middle_initial).toBe('A')
    expect(prof?.last_name).toBe('Santos')
    expect(prof?.suffix).toBe('Jr.')
  })

  it('blocks a duplicate email with a field-specific message', async () => {
    const { token } = await instructorWithClassLink()
    const email = `${tag}-dupe@x.com`
    await registerViaLink({ token, firstName: 'Alice', lastName: 'A', email, password: PW, studentNumber: 'SN-A' })
    const { token: token2 } = await instructorWithClassLink()
    await expect(registerViaLink({ token: token2, firstName: 'Bob', lastName: 'B', email, password: PW, studentNumber: 'SN-B' }))
      .rejects.toThrow(/email .* already registered/i)
  })

  it('blocks a duplicate student number with a field-specific message', async () => {
    const { token } = await instructorWithClassLink()
    await registerViaLink({ token, firstName: 'Alice', lastName: 'A', email: `${tag}-sn1@x.com`, password: PW, studentNumber: 'SN-DUP' })
    const { token: token2 } = await instructorWithClassLink()
    await expect(registerViaLink({ token: token2, firstName: 'Bob', lastName: 'B', email: `${tag}-sn2@x.com`, password: PW, studentNumber: 'SN-DUP' }))
      .rejects.toThrow(/student number .* already registered/i)
  })

  it('rejects an expired link', async () => {
    const { token } = await instructorWithClassLink()
    const admin = createAdminClient()
    await admin.from('enroll_links').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('token', token)
    await expect(registerViaLink({ token, firstName: 'Exp', lastName: 'User', email: `${tag}-exp@x.com`, password: PW, studentNumber: 'SN-X' }))
      .rejects.toThrow(/expired/i)
  })

  it('rejects a revoked link', async () => {
    const { token } = await instructorWithClassLink()
    const admin = createAdminClient()
    await admin.from('enroll_links').update({ revoked_at: new Date().toISOString() }).eq('token', token)
    await expect(registerViaLink({ token, firstName: 'Rev', lastName: 'User', email: `${tag}-rev@x.com`, password: PW, studentNumber: 'SN-R' }))
      .rejects.toThrow(/revoked/i)
  })

  it('rejects an empty student number', async () => {
    const { token } = await instructorWithClassLink()
    await expect(registerViaLink({ token, firstName: 'Empty', lastName: 'User', email: `${tag}-empty@x.com`, password: PW, studentNumber: '' }))
      .rejects.toThrow(/student number is required/i)
  })
})

describe('approve / reject pending', () => {
  it('approve activates the profile and enrollment', async () => {
    const { instr, classId, token } = await instructorWithClassLink()
    const email = `${tag}-appr@x.com`
    await registerViaLink({ token, firstName: 'Pend', lastName: 'Student', email, password: PW, studentNumber: 'SN-APPR' })
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
    await registerViaLink({ token, firstName: 'Rej', lastName: 'Student', email, password: PW, studentNumber: 'SN-REJ' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
    await setTestUser(instr.email, PW)
    await rejectPending({ studentId: prof!.id })
    const { data: gone } = await admin.from('profiles').select('id').eq('id', prof!.id).maybeSingle()
    expect(gone).toBeNull()
  })

  it('approve rejects an already-active (non-pending) student', async () => {
    const { instr, classId, token } = await instructorWithClassLink()
    const email = `${tag}-active-guard@x.com`
    await registerViaLink({ token, firstName: 'Active', lastName: 'Guard', email, password: PW, studentNumber: 'SN-ACTIVE-GUARD' })
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('email', email).single()
    // First approve makes the student active.
    await setTestUser(instr.email, PW)
    await approvePending({ studentId: prof!.id })
    // Second approve attempt must be rejected: student is no longer pending.
    await setTestUser(instr.email, PW)
    await expect(approvePending({ studentId: prof!.id })).rejects.toThrow()
  })

  it('reject refuses a student the caller does not instruct (tenant isolation)', async () => {
    const { token } = await instructorWithClassLink()
    const email = `${tag}-rej-x@x.com`
    await registerViaLink({ token, firstName: 'Cross', lastName: 'Tenant', email, password: PW, studentNumber: 'SN-REJ-X' })
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
