import { afterEach, vi } from 'vitest'
import { clearTestUser } from '@/tests/helpers/auth'

// Server actions call refresh() from next/cache, which only works inside a real
// Server Action request scope. Unit tests invoke the actions as plain functions,
// so stub refresh() to a no-op while leaving all other next/cache exports intact.
vi.mock('next/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/cache')>()
  return { ...actual, refresh: vi.fn() }
})

afterEach(() => {
  clearTestUser()
})
