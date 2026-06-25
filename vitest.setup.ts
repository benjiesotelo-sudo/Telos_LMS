import { afterEach } from 'vitest'
import { clearTestUser } from '@/tests/helpers/auth'

afterEach(() => {
  clearTestUser()
})
