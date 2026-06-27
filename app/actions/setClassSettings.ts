'use server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { refresh } from 'next/cache'

export const CLASS_PERIODS = [
  '1st Semester',
  '2nd Semester',
  'Midyear',
  'Special Course',
] as const

export type ClassPeriod = (typeof CLASS_PERIODS)[number]

export interface SetClassSettingsInput {
  classId: string
  period: string
  sectionLabel: string
}

export async function setClassSettings(
  input: SetClassSettingsInput,
): Promise<{ ok: true }> {
  // ── 1. Validate period ────────────────────────────────────────────────────
  if (!(CLASS_PERIODS as readonly string[]).includes(input.period)) {
    throw new Error(
      `Invalid period "${input.period}": must be one of ${CLASS_PERIODS.join(', ')}`,
    )
  }

  // ── 2. Validate section label ─────────────────────────────────────────────
  if (!input.sectionLabel.trim()) {
    throw new Error('Section label must not be empty')
  }

  // ── 3. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) throw new Error('Not authenticated')
  const callerId = auth.user.id

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single()
  const isAdmin = caller?.role === 'admin'

  // ── 4. Owner guard ────────────────────────────────────────────────────────
  const admin = createAdminClient()

  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select('instructor_id')
    .eq('id', input.classId)
    .single()
  if (clsErr || !cls) throw new Error('Class not found')
  if (!isAdmin && cls.instructor_id !== callerId) throw new Error('Not the class owner')

  // ── 5. Update ─────────────────────────────────────────────────────────────
  const { error: updErr } = await admin
    .from('classes')
    .update({
      period: input.period,
      section_label: input.sectionLabel.trim(),
    })
    .eq('id', input.classId)
  if (updErr) throw new Error(`Failed to update class settings: ${updErr.message}`)

  refresh()
  return { ok: true }
}
