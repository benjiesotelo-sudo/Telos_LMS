'use server'

import { createClient } from '@/lib/supabase/server'

export async function updatePassword({
  newPassword,
}: {
  newPassword: string
}): Promise<{ ok: true }> {
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) {
    throw new Error('Not authenticated')
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    throw new Error(error.message)
  }

  return { ok: true }
}
