'use server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertAdmin } from './_adminGuard'
import { composeFullName } from '@/lib/name'
import { refresh } from 'next/cache'
import type { UserRole, UserStatus } from '@/lib/types'

const VALID_ROLES: UserRole[] = ['admin', 'instructor', 'student']

export interface AdminUpsertUserInput {
  id?: string
  email: string
  role: UserRole
  status: UserStatus
  prefix?: string
  firstName: string
  middleInitial?: string
  lastName: string
  suffix?: string
  studentNumber?: string
  password?: string
}

export async function adminUpsertUser(input: AdminUpsertUserInput): Promise<{ id: string }> {
  await assertAdmin()

  if (!VALID_ROLES.includes(input.role)) {
    throw new Error(`Invalid role: "${input.role}". Must be one of: ${VALID_ROLES.join(', ')}`)
  }

  const admin = createAdminClient()

  const prefix = (input.prefix ?? '').trim()
  const firstName = input.firstName.trim()
  const middleInitial = (input.middleInitial ?? '').trim()
  const lastName = input.lastName.trim()
  const suffix = (input.suffix ?? '').trim()
  const full_name = composeFullName({ prefix, firstName, middleInitial, lastName, suffix })
  const studentNumber = (input.studentNumber ?? '').trim() || null

  if (!input.id) {
    // CREATE — use auth.admin.createUser; the handle_new_user trigger materializes the profile.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
      user_metadata: {
        role: input.role,
        status: input.status,
        full_name,
        student_number: studentNumber,
        prefix,
        first_name: firstName,
        middle_initial: middleInitial,
        last_name: lastName,
        suffix,
      },
    })
    if (createErr || !created.user) throw new Error(createErr?.message ?? 'Failed to create user')
    refresh()
    return { id: created.user.id }
  }

  // UPDATE — update the profile row via the admin client (so role/status changes are allowed).
  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      full_name,
      role: input.role,
      status: input.status,
      prefix,
      first_name: firstName,
      middle_initial: middleInitial,
      last_name: lastName,
      suffix,
      student_number: studentNumber,
    })
    .eq('id', input.id)

  if (profileErr) throw new Error(profileErr.message)

  // Optionally reset the password too.
  if (input.password) {
    const { error: pwErr } = await admin.auth.admin.updateUserById(input.id, { password: input.password })
    if (pwErr) throw new Error(pwErr.message)
  }

  refresh()
  return { id: input.id }
}
