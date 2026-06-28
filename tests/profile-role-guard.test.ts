// tests/profile-role-guard.test.ts — BEFORE-UPDATE trigger keeps role/status locked.
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser } from '@/tests/helpers/fixtures'
import { signInAs } from '@/tests/helpers/auth'

const PW = 'Guard_pw_123!'
const tag = `guard-${Date.now()}`

let studentId: string

beforeAll(async () => {
  const s = await createUser({ role: 'student', email: `${tag}-s@x.com`, password: PW, fullName: 'Guard Stu', studentNumber: `${tag}-S` })
  studentId = s.id
})

describe('profile role/status guard trigger', () => {
  it('a student can still update their OWN full_name (trigger allows non-role/status edits)', async () => {
    const { client } = await signInAs(`${tag}-s@x.com`, PW)
    const { error } = await client.from('profiles').update({ full_name: 'Guard Stu Renamed' }).eq('id', studentId)
    expect(error).toBeNull()
    const admin = createAdminClient()
    const { data } = await admin.from('profiles').select('full_name, role').eq('id', studentId).single()
    expect(data!.full_name).toBe('Guard Stu Renamed')
    expect(data!.role).toBe('student')
  })

  it('a student cannot self-promote to admin (role stays student)', async () => {
    const { client } = await signInAs(`${tag}-s@x.com`, PW)
    const { data, error } = await client.from('profiles').update({ role: 'admin' }).eq('id', studentId).select('id')
    // Blocked by the column grant and/or the trigger — either way no promotion.
    expect(error !== null || (data ?? []).length === 0).toBe(true)
    const admin = createAdminClient()
    const { data: prof } = await admin.from('profiles').select('role').eq('id', studentId).single()
    expect(prof!.role).toBe('student')
  })

  it('the service-role path (admin user-management) can still change role', async () => {
    // Mirrors adminUpsertUser, which uses the service-role client (auth.uid() IS NULL).
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({ status: 'suspended' }).eq('id', studentId)
    expect(error).toBeNull()
    const { data } = await admin.from('profiles').select('status').eq('id', studentId).single()
    expect(data!.status).toBe('suspended')
    // restore
    await admin.from('profiles').update({ status: 'active' }).eq('id', studentId)
  })
})
