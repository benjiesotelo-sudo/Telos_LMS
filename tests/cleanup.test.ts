import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser } from '@/tests/helpers/fixtures'

const PW = 'Test_pw_123!'
const tag = `cleanup-${Date.now()}`

describe('purge_expired_pending', () => {
  it('deletes a pending profile older than 7 days', async () => {
    const user = await createUser({
      role: 'student',
      email: `${tag}-old@x.com`,
      password: PW,
      fullName: 'OldPending',
      studentNumber: 'CLN-001',
    })
    const admin = createAdminClient()

    // Flip to pending and back-date created_at by 8 days
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ status: 'pending', created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('id', user.id)
    expect(updateErr).toBeNull()

    // Call purge_expired_pending via raw SQL through the admin client
    // (PostgREST may not expose SECURITY DEFINER functions in the public schema directly;
    //  we use rpc first and fall back to raw SQL if needed)
    const { error: rpcErr } = await admin.rpc('purge_expired_pending')
    expect(rpcErr).toBeNull()

    // Profile should be gone (cascade from auth.users → profiles)
    const { data: gone } = await admin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    expect(gone).toBeNull()
  })

  it('leaves a fresh pending profile (created today) untouched', async () => {
    const user = await createUser({
      role: 'student',
      email: `${tag}-new@x.com`,
      password: PW,
      fullName: 'FreshPending',
      studentNumber: 'CLN-002',
    })
    const admin = createAdminClient()

    // Flip to pending but leave created_at as now (default)
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ status: 'pending' })
      .eq('id', user.id)
    expect(updateErr).toBeNull()

    // Run purge
    const { error: rpcErr } = await admin.rpc('purge_expired_pending')
    expect(rpcErr).toBeNull()

    // Fresh profile should SURVIVE
    const { data: alive } = await admin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    expect(alive).not.toBeNull()
    expect(alive?.id).toBe(user.id)
  })
})
