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

  // Restore access: an admin reset is meant to let the user back in. A student who
  // self-registered is 'pending' and gateRoute parks them at /holding regardless of
  // password — so resetting the password ALONE never unblocks them (the live-class bug).
  // Re-activate any PENDING account here so a reset always yields a usable login. A
  // deliberately 'suspended' account is left untouched (un-suspend via Edit user).
  const { error: statusErr } = await admin
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', input.id)
    .eq('status', 'pending')
  if (statusErr) throw new Error(statusErr.message)

  return { ok: true }
}
