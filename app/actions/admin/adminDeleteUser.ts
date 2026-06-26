'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertAdmin } from './_adminGuard'
import { refresh } from 'next/cache'

export async function adminDeleteUser(input: { id: string }): Promise<{ ok: boolean }> {
  const { userId } = await assertAdmin()

  if (input.id === userId) {
    throw new Error('Cannot delete yourself (self-delete is not allowed)')
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(input.id)
  if (error) throw new Error(error.message)

  refresh()
  return { ok: true }
}
