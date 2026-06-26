// Shared admin guard — NOT a 'use server' file; plain helper module.
import { createClient } from '@/lib/supabase/server'

/**
 * Asserts the current caller is authenticated and has role 'admin'.
 * Throws 'Not authenticated' or 'Forbidden: admin only' as appropriate.
 * Returns the caller's user id so action handlers can use it (e.g. self-delete guard).
 */
export async function assertAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    throw new Error('Forbidden: admin only')
  }

  return { userId: auth.user.id }
}
