// tests/assessment-settings.test.ts — edit assessment name/type/default timer
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { updateAssessmentSettings } from '@/app/actions/updateAssessmentSettings'

const PW = 'Aset_pw_123!'
const tag = `aset-${Date.now()}`
let instructorId: string
let assessmentId: string

beforeAll(async () => {
  const admin = createAdminClient()
  const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'ASet Instr' })
  instructorId = instr.id
  await createUser({ role: 'instructor', email: `${tag}-i2@x.com`, password: PW, fullName: 'Other' })
  const { data: a } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'Old Name', type: 'quiz', total_points: 5, questions: [] }).select('id').single()
  assessmentId = a!.id
})

describe('updateAssessmentSettings', () => {
  it('owner edits name, type, and default duration', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await updateAssessmentSettings({ assessmentId, title: 'New Name', type: 'exam', defaultDurationMinutes: 45 })
    const admin = createAdminClient()
    const { data } = await admin.from('assessments').select('title, type, default_duration_minutes').eq('id', assessmentId).single()
    expect(data!.title).toBe('New Name')
    expect(data!.type).toBe('exam')
    expect(data!.default_duration_minutes).toBe(45)
  })

  it('clears the timer with null and rejects an empty title', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await updateAssessmentSettings({ assessmentId, defaultDurationMinutes: null })
    const admin = createAdminClient()
    const { data } = await admin.from('assessments').select('default_duration_minutes').eq('id', assessmentId).single()
    expect(data!.default_duration_minutes).toBeNull()
    await expect(updateAssessmentSettings({ assessmentId, title: '   ' })).rejects.toThrow(/empty/i)
  })

  it('a non-owner is rejected', async () => {
    await setTestUser(`${tag}-i2@x.com`, PW)
    await expect(updateAssessmentSettings({ assessmentId, title: 'Hacked' })).rejects.toThrow(/owner/i)
  })
})
