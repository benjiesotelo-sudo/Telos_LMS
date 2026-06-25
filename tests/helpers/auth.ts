import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function signInAs(email: string, password: string) {
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  const accessToken = data.session!.access_token
  return { client, accessToken }
}

export async function setTestUser(email: string, password: string) {
  const { accessToken } = await signInAs(email, password)
  globalThis.__TELOS_TEST_USER__ = { accessToken }
}

export function clearTestUser() {
  delete globalThis.__TELOS_TEST_USER__
}
