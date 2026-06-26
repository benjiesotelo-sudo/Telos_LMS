import { describe, it, expect, afterEach } from 'vitest'
import { signInAs, setTestUser, clearTestUser } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'
import { updatePassword } from '@/app/actions/updatePassword'

afterEach(clearTestUser)

const BASE_PW = 'Base_pw_123!'
const NEW_PW = 'NewPass_456!'
const tag = `pwd-${Date.now()}`

describe('updatePassword', () => {
  it('throws when password is too short (< 6 chars)', async () => {
    const user = await createUser({
      role: 'instructor',
      email: `${tag}-short@x.com`,
      password: BASE_PW,
      fullName: 'Short PW Test',
    })
    await setTestUser(user.email, BASE_PW)
    await expect(updatePassword({ newPassword: 'abc' }))
      .rejects.toThrow(/at least 6 characters/i)
  })

  it('throws when not authenticated', async () => {
    // No setTestUser — unauthenticated
    await expect(updatePassword({ newPassword: 'ValidPass1!' }))
      .rejects.toThrow(/not authenticated/i)
  })

  it('changes the password and the new password works for sign-in', async () => {
    const user = await createUser({
      role: 'instructor',
      email: `${tag}-change@x.com`,
      password: BASE_PW,
      fullName: 'Change PW Test',
    })
    await setTestUser(user.email, BASE_PW)

    const result = await updatePassword({ newPassword: NEW_PW })
    expect(result.ok).toBe(true)

    // New password should work
    const { accessToken } = await signInAs(user.email, NEW_PW)
    expect(accessToken).toBeTruthy()

    // Old password should fail
    await expect(signInAs(user.email, BASE_PW))
      .rejects.toThrow()
  })
})
