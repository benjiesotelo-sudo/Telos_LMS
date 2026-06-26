'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertAdmin } from './_adminGuard'
import type { AdminUserRow } from '@/lib/types'

export async function listUsers(): Promise<AdminUserRow[]> {
  await assertAdmin()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, status, student_number')
    .order('full_name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((p: any) => ({
    id: p.id,
    fullName: p.full_name ?? '',
    email: p.email ?? '',
    role: p.role,
    status: p.status,
    studentNumber: p.student_number ?? null,
  }))
}
