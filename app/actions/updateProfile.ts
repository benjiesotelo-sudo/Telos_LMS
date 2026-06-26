'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { composeFullName } from '@/lib/name'
import { refresh } from 'next/cache'

export async function updateProfile(input: {
  prefix?: string
  firstName: string
  middleInitial?: string
  lastName: string
  suffix?: string
  studentNumber?: string
}): Promise<{ ok: true }> {
  const supabase = await createClient()
  const { data: auth, error } = await supabase.auth.getUser()
  if (error || !auth.user) throw new Error('Not authenticated')

  if (!input.firstName.trim()) throw new Error('First name is required')
  if (!input.lastName.trim()) throw new Error('Last name is required')

  const full_name = composeFullName({
    prefix: input.prefix,
    firstName: input.firstName,
    middleInitial: input.middleInitial,
    lastName: input.lastName,
    suffix: input.suffix,
  })

  // Use admin client scoped to caller's own row so we can write full_name +
  // student_number together with the name parts — never touching role/status/email.
  const admin = createAdminClient()
  const { error: updErr } = await admin
    .from('profiles')
    .update({
      prefix: input.prefix ?? '',
      first_name: input.firstName,
      middle_initial: input.middleInitial ?? '',
      last_name: input.lastName,
      suffix: input.suffix ?? '',
      full_name,
      student_number: input.studentNumber ?? null,
    })
    .eq('id', auth.user.id)

  if (updErr) throw new Error(updErr.message)

  refresh()
  return { ok: true }
}
