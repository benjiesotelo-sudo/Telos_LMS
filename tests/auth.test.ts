import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { gateRoute } from '@/lib/auth/gateRoute'
import { signInAs, setTestUser, clearTestUser } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedPeriod } from '@/tests/helpers/fixtures'
import { enrollStudent } from '@/app/actions/enrollStudent'
import { acceptInvite } from '@/app/actions/acceptInvite'
import { createAdminClient } from '@/lib/supabase/server'

describe('gateRoute (pure helper)', () => {
  it('unauthenticated user on a protected area -> /login', () => {
    expect(gateRoute(null, '/instructor')).toBe('/login')
    expect(gateRoute(null, '/student')).toBe('/login')
    expect(gateRoute(null, '/student/take/abc')).toBe('/login')
  })

  it('unauthenticated user on a public route -> no redirect', () => {
    expect(gateRoute(null, '/login')).toBeNull()
    expect(gateRoute(null, '/')).toBeNull()
    expect(gateRoute(null, '/invite/tok-123')).toBeNull()
    expect(gateRoute(null, '/holding')).toBeNull()
  })

  it('a student is blocked from /instructor and sent to /student', () => {
    expect(gateRoute({ role: 'student', status: 'active' }, '/instructor')).toBe('/student')
    expect(gateRoute({ role: 'student', status: 'active' }, '/instructor/import')).toBe('/student')
  })

  it('an instructor is blocked from /student and sent to /instructor', () => {
    expect(gateRoute({ role: 'instructor', status: 'active' }, '/student')).toBe('/instructor')
  })

  it('an instructor on /instructor is NOT bounced (no redirect)', () => {
    expect(gateRoute({ role: 'instructor', status: 'active' }, '/instructor')).toBeNull()
    expect(gateRoute({ role: 'instructor', status: 'active' }, '/instructor/submissions')).toBeNull()
  })

  it('a student on /student is NOT bounced (no redirect)', () => {
    expect(gateRoute({ role: 'student', status: 'active' }, '/student/results/x')).toBeNull()
  })

  it('an already-authenticated user hitting / or /login goes to their home', () => {
    expect(gateRoute({ role: 'instructor', status: 'active' }, '/login')).toBe('/instructor')
    expect(gateRoute({ role: 'instructor', status: 'active' }, '/')).toBe('/instructor')
    expect(gateRoute({ role: 'student', status: 'active' }, '/login')).toBe('/student')
    expect(gateRoute({ role: 'student', status: 'active' }, '/')).toBe('/student')
  })

  it('a non-active account on a protected area -> /holding', () => {
    expect(gateRoute({ role: 'student', status: 'pending' }, '/student')).toBe('/holding')
    expect(gateRoute({ role: 'instructor', status: 'suspended' }, '/instructor')).toBe('/holding')
  })

  it('a non-active account already on /holding is NOT bounced', () => {
    expect(gateRoute({ role: 'student', status: 'pending' }, '/holding')).toBeNull()
  })
})

afterEach(clearTestUser)

describe('auth integration (self-provisioned instructor)', () => {
  const u = Date.now()
  const instrEmail = `instr-${u}@telos.test`
  const instrPass = 'Instr-pass-123!'

  beforeAll(async () => {
    await createUser({
      role: 'instructor',
      email: instrEmail,
      password: instrPass,
      fullName: 'Auth Test Instructor',
    })
  })

  it('the self-provisioned instructor can sign in', async () => {
    const { client, accessToken } = await signInAs(instrEmail, instrPass)
    expect(accessToken).toBeTruthy()
    const { data, error } = await client.auth.getUser()
    expect(error).toBeNull()
    expect(data.user?.email).toBe(instrEmail)
  })
})

describe('enrollStudent (instructor creates an invite link)', () => {
  const u = Date.now() + 1
  const instrEmail = `enroll-instr-${u}@telos.test`
  const instrPass = 'Enroll-pass-123!'
  let instructorId: string
  let courseId: string
  let periodId: string

  beforeAll(async () => {
    const instr = await createUser({
      role: 'instructor',
      email: instrEmail,
      password: instrPass,
      fullName: 'Enroll Instructor',
    })
    instructorId = instr.id
    courseId = (await seedCourse({ instructorId, code: 'AMS0011', title: 'Algebra & Trig' })).id
    periodId = (await seedPeriod({ courseId, instructorId, label: '1st Semester' })).id
  })

  it('inserts an unconsumed invites row and returns its /invite/[token] absolute URL', async () => {
    await setTestUser(instrEmail, instrPass)
    const { inviteUrl } = await enrollStudent({
      courseId,
      periodId,
      email: 'newstudent@telos.test',
      fullName: 'New Student',
      studentNumber: '2026-00001',
    })

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    expect(inviteUrl.startsWith(`${base}/invite/`)).toBe(true)
    const token = inviteUrl.slice(`${base}/invite/`.length)
    expect(token.length).toBeGreaterThan(10)

    const admin = createAdminClient()
    const { data } = await admin
      .from('invites')
      .select('email, course_id, period_id, full_name, student_number, consumed_at')
      .eq('token', token)
      .single()
    expect(data?.email).toBe('newstudent@telos.test')
    expect(data?.course_id).toBe(courseId)
    expect(data?.period_id).toBe(periodId)
    expect(data?.full_name).toBe('New Student')
    expect(data?.student_number).toBe('2026-00001')
    expect(data?.consumed_at).toBeNull()
  })
})

describe('acceptInvite (provision student, single-use token)', () => {
  const u = Date.now() + 2
  const instrEmail = `accept-instr-${u}@telos.test`
  const instrPass = 'Accept-pass-123!'
  const studentEmail = `accept-student-${u}@telos.test`
  const studentPass = 'Student-pass-123!'
  let instructorId: string
  let courseId: string
  let periodId: string
  let token: string

  beforeAll(async () => {
    const instr = await createUser({
      role: 'instructor',
      email: instrEmail,
      password: instrPass,
      fullName: 'Accept Instructor',
    })
    instructorId = instr.id
    courseId = (await seedCourse({ instructorId, code: 'AMS0011', title: 'Algebra & Trig' })).id
    periodId = (await seedPeriod({ courseId, instructorId, label: '1st Semester' })).id

    await setTestUser(instrEmail, instrPass)
    const { inviteUrl } = await enrollStudent({
      courseId,
      periodId,
      email: studentEmail,
      fullName: 'Accept Student',
      studentNumber: '2026-09999',
    })
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    token = inviteUrl.slice(`${base}/invite/`.length)
    clearTestUser()
  })

  it('accepting yields a student profile + enrollment and consumes the token', async () => {
    const res = await acceptInvite({ token, password: studentPass })
    expect(res).toEqual({ ok: true })

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles')
      .select('role, status, email, full_name, student_number')
      .eq('email', studentEmail)
      .single()
    expect(profile?.role).toBe('student')
    expect(profile?.status).toBe('active')
    expect(profile?.email).toBe(studentEmail)
    expect(profile?.full_name).toBe('Accept Student')
    expect(profile?.student_number).toBe('2026-09999')

    const { data: prof2 } = await admin
      .from('profiles')
      .select('id')
      .eq('email', studentEmail)
      .single()
    const { data: enrollment } = await admin
      .from('enrollments')
      .select('course_id, period_id, status')
      .eq('student_id', prof2!.id)
      .single()
    expect(enrollment?.course_id).toBe(courseId)
    expect(enrollment?.period_id).toBe(periodId)

    const { data: invite } = await admin
      .from('invites')
      .select('consumed_at')
      .eq('token', token)
      .single()
    expect(invite?.consumed_at).not.toBeNull()

    // The new student can sign in with the chosen password.
    const { accessToken } = await signInAs(studentEmail, studentPass)
    expect(accessToken).toBeTruthy()
    clearTestUser()
  })

  it('the token is single-use: a second accept fails', async () => {
    await expect(acceptInvite({ token, password: 'Another-pass-123!' })).rejects.toThrow()
  })
})
