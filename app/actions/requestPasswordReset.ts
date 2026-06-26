'use server'

import { createClient } from '@/lib/supabase/server'

export async function requestPasswordReset({
  email,
}: {
  email: string
}): Promise<{ ok: true }> {
  const supabase = await createClient()
  // Anti-enumeration: fire-and-forget — never reveal if email exists
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000') +
      '/reset-password',
  })
  return { ok: true }
}
