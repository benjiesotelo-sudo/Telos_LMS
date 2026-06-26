import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { gateRoute } from '@/lib/auth/gateRoute'
import { signInAs, setTestUser, clearTestUser } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'

describe('gateRoute (pure helper)', () => {
  it('unauthenticated user on a protected area -> /login', () => {
    expect(gateRoute(null, '/instructor')).toBe('/login')
    expect(gateRoute(null, '/student')).toBe('/login')
    expect(gateRoute(null, '/student/take/abc')).toBe('/login')
  })

  it('unauthenticated user on a public route -> no redirect', () => {
    expect(gateRoute(null, '/login')).toBeNull()
    expect(gateRoute(null, '/')).toBeNull()
    expect(gateRoute(null, '/holding')).toBeNull()
    expect(gateRoute(null, '/register/abc-123')).toBeNull()
  })

  it('/invite is no longer a public prefix (route was removed)', () => {
    expect(gateRoute(null, '/invite/x')).toBe('/login')
  })

  it('unauthenticated user on /reset-password -> no redirect (public route)', () => {
    expect(gateRoute(null, '/reset-password')).toBeNull()
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
