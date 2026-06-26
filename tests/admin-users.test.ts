import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser, clearTestUser } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'
import { listUsers } from '@/app/actions/admin/listUsers'
import { adminUpsertUser } from '@/app/actions/admin/adminUpsertUser'
import { adminDeleteUser } from '@/app/actions/admin/adminDeleteUser'
import { adminResetPassword } from '@/app/actions/admin/adminResetPassword'

const PW = 'Test_pw_123!'
const tag = `au-${Date.now()}`

// Track IDs for cleanup
const createdIds: string[] = []

afterAll(async () => {
  clearTestUser()
  const admin = createAdminClient()
  for (const id of createdIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {})
  }
})

describe('admin-users: as admin', () => {
  let adminEmail: string
  let adminUserId: string
  let instructorId: string
  let createdStudentId: string

  beforeAll(async () => {
    const adminUser = await createUser({ role: 'admin', email: `${tag}-admin@x.com`, password: PW, fullName: 'Admin User' })
    adminEmail = adminUser.email
    adminUserId = adminUser.id
    createdIds.push(adminUserId)

    const instrUser = await createUser({ role: 'instructor', email: `${tag}-instr@x.com`, password: PW, fullName: 'Instr User' })
    instructorId = instrUser.id
    createdIds.push(instructorId)
  })

  it('listUsers returns all users including the admin and instructor', async () => {
    await setTestUser(adminEmail, PW)
    const rows = await listUsers()
    expect(Array.isArray(rows)).toBe(true)
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(adminUserId)
    expect(ids).toContain(instructorId)
    const adminRow = rows.find((r) => r.id === adminUserId)!
    expect(adminRow.fullName).toBe('Admin User')
    expect(adminRow.email).toBe(`${tag}-admin@x.com`)
    expect(adminRow.role).toBe('admin')
    expect(adminRow.status).toBe('active')
  })

  it('adminUpsertUser creates a new user (no id)', async () => {
    await setTestUser(adminEmail, PW)
    const result = await adminUpsertUser({
      email: `${tag}-new@x.com`,
      role: 'student',
      status: 'active',
      firstName: 'New',
      lastName: 'Student',
      studentNumber: `${tag}-SN001`,
      password: PW,
    })
    expect(result.id).toBeTruthy()
    createdStudentId = result.id
    createdIds.push(createdStudentId)

    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('full_name, email, role, status, student_number').eq('id', createdStudentId).single()
    expect(prof?.full_name).toBe('New Student')
    expect(prof?.email).toBe(`${tag}-new@x.com`)
    expect(prof?.role).toBe('student')
    expect(prof?.status).toBe('active')
    expect(prof?.student_number).toBe(`${tag}-SN001`)
  })

  it('adminUpsertUser edits an existing user role and status', async () => {
    await setTestUser(adminEmail, PW)
    await adminUpsertUser({
      id: instructorId,
      email: `${tag}-instr@x.com`,
      role: 'admin',
      status: 'active',
      firstName: 'Instr',
      lastName: 'User',
    })

    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('role').eq('id', instructorId).single()
    expect(prof?.role).toBe('admin')

    // Change back to instructor
    await adminUpsertUser({
      id: instructorId,
      email: `${tag}-instr@x.com`,
      role: 'instructor',
      status: 'active',
      firstName: 'Instr',
      lastName: 'User',
    })
    const { data: prof2 } = await admin.from('profiles').select('role').eq('id', instructorId).single()
    expect(prof2?.role).toBe('instructor')
  })

  it('adminUpsertUser rejects invalid role', async () => {
    await setTestUser(adminEmail, PW)
    await expect(
      adminUpsertUser({
        email: `${tag}-bad@x.com`,
        role: 'superuser' as any,
        status: 'active',
        firstName: 'Bad',
        lastName: 'Role',
        password: PW,
      })
    ).rejects.toThrow(/invalid role/i)
  })

  it('adminResetPassword changes the password for a user', async () => {
    await setTestUser(adminEmail, PW)
    const newPw = 'NewPw_456!'
    const result = await adminResetPassword({ id: createdStudentId, newPassword: newPw })
    expect(result.ok).toBe(true)

    // Verify new password works by signing in
    const { signInAs } = await import('@/tests/helpers/auth')
    const { accessToken } = await signInAs(`${tag}-new@x.com`, newPw)
    expect(accessToken).toBeTruthy()
  })

  it('adminResetPassword rejects passwords shorter than 6 chars', async () => {
    await setTestUser(adminEmail, PW)
    await expect(adminResetPassword({ id: createdStudentId, newPassword: 'abc' })).rejects.toThrow(/password/i)
  })

  it('adminDeleteUser deletes a user', async () => {
    const toDelete = await createUser({ role: 'student', email: `${tag}-del@x.com`, password: PW, fullName: 'To Delete' })
    await setTestUser(adminEmail, PW)
    const result = await adminDeleteUser({ id: toDelete.id })
    expect(result.ok).toBe(true)

    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('id').eq('id', toDelete.id).maybeSingle()
    expect(prof).toBeNull()
  })

  it('adminDeleteUser refuses to delete yourself (self-delete)', async () => {
    await setTestUser(adminEmail, PW)
    await expect(adminDeleteUser({ id: adminUserId })).rejects.toThrow(/self/i)
  })
})

describe('admin-users: non-admin (instructor) is blocked on every action', () => {
  let instrEmail: string
  let instrId: string

  beforeAll(async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-blk@x.com`, password: PW, fullName: 'Blocked Instr' })
    instrEmail = instr.email
    instrId = instr.id
    createdIds.push(instrId)
  })

  it('listUsers throws Forbidden for non-admin', async () => {
    await setTestUser(instrEmail, PW)
    await expect(listUsers()).rejects.toThrow(/forbidden/i)
  })

  it('adminUpsertUser throws Forbidden for non-admin', async () => {
    await setTestUser(instrEmail, PW)
    await expect(
      adminUpsertUser({ email: 'x@x.com', role: 'student', status: 'active', firstName: 'X', lastName: 'Y', password: PW })
    ).rejects.toThrow(/forbidden/i)
  })

  it('adminDeleteUser throws Forbidden for non-admin', async () => {
    await setTestUser(instrEmail, PW)
    await expect(adminDeleteUser({ id: 'some-id' })).rejects.toThrow(/forbidden/i)
  })

  it('adminResetPassword throws Forbidden for non-admin', async () => {
    await setTestUser(instrEmail, PW)
    await expect(adminResetPassword({ id: 'some-id', newPassword: 'newpass123' })).rejects.toThrow(/forbidden/i)
  })
})
