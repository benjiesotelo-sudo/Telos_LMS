'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertAdmin } from './_adminGuard'

export async function adminResetPassword(input: { id: string; newPassword: string }): Promise<{ ok: boolean }> {
  await assertAdmin()

  if (!input.newPassword || input.newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(input.id, { password: input.newPassword })
  if (error) throw new Error(error.message)

  return { ok: true }
}
