import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'
import { updateProfile } from '@/app/actions/updateProfile'
import { composeFullName } from '@/lib/name'

const PW = 'Test_pw_123!'
const tag = `profile-${Date.now()}`

describe('updateProfile', () => {
  it('updates all name parts and derives full_name, leaving role and status untouched', async () => {
    const user = await createUser({
      role: 'instructor',
      email: `${tag}-instr@x.com`,
      password: PW,
      fullName: 'Original Name',
    })
    await setTestUser(user.email, PW)

    const parts = {
      prefix: 'Dr.',
      firstName: 'Maria',
      middleInitial: 'A',
      lastName: 'Santos',
      suffix: 'Jr.',
      studentNumber: '2021-00001',
    }
    const result = await updateProfile(parts)
    expect(result.ok).toBe(true)

    const admin = createAdminClient()
    const { data: prof } = await admin
      .from('profiles')
      .select('prefix, first_name, middle_initial, last_name, suffix, full_name, student_number, role, status')
      .eq('id', user.id)
      .single()

    expect(prof?.prefix).toBe('Dr.')
    expect(prof?.first_name).toBe('Maria')
    expect(prof?.middle_initial).toBe('A')
    expect(prof?.last_name).toBe('Santos')
    expect(prof?.suffix).toBe('Jr.')
    expect(prof?.full_name).toBe(composeFullName({
      prefix: 'Dr.',
      firstName: 'Maria',
      middleInitial: 'A',
      lastName: 'Santos',
      suffix: 'Jr.',
    }))
    expect(prof?.student_number).toBe('2021-00001')
    // Must NOT mutate role or status
    expect(prof?.role).toBe('instructor')
    expect(prof?.status).toBe('active')
  })

  it('works for a student user too', async () => {
    const user = await createUser({
      role: 'student',
      email: `${tag}-stud@x.com`,
      password: PW,
      fullName: 'Student User',
      studentNumber: 'SN-ORIG',
    })
    await setTestUser(user.email, PW)

    await updateProfile({ firstName: 'Juan', lastName: 'Cruz', studentNumber: 'SN-UPDATED' })

    const admin = createAdminClient()
    const { data: prof } = await admin
      .from('profiles')
      .select('first_name, last_name, full_name, student_number, role, status')
      .eq('id', user.id)
      .single()

    expect(prof?.first_name).toBe('Juan')
    expect(prof?.last_name).toBe('Cruz')
    expect(prof?.full_name).toBe(composeFullName({ firstName: 'Juan', lastName: 'Cruz' }))
    expect(prof?.student_number).toBe('SN-UPDATED')
    expect(prof?.role).toBe('student')
    expect(prof?.status).toBe('active')
  })

  it('throws when firstName is empty', async () => {
    const user = await createUser({
      role: 'student',
      email: `${tag}-empty-fn@x.com`,
      password: PW,
      fullName: 'Some User',
    })
    await setTestUser(user.email, PW)

    await expect(updateProfile({ firstName: '', lastName: 'Santos' }))
      .rejects.toThrow(/first name/i)
  })

  it('throws when lastName is empty', async () => {
    const user = await createUser({
      role: 'student',
      email: `${tag}-empty-ln@x.com`,
      password: PW,
      fullName: 'Some User',
    })
    await setTestUser(user.email, PW)

    await expect(updateProfile({ firstName: 'Maria', lastName: '' }))
      .rejects.toThrow(/last name/i)
  })

  it('throws when not authenticated', async () => {
    // No setTestUser — unauthenticated request
    await expect(updateProfile({ firstName: 'X', lastName: 'Y' }))
      .rejects.toThrow(/not authenticated/i)
  })
})
