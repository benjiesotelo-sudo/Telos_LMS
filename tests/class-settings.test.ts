// tests/class-settings.test.ts
//
// TDD integration tests for setClassSettings.
//
// RED → GREEN: tests are written first to define the expected contract,
// then the action is implemented to make them pass.

import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { setClassSettings } from '@/app/actions/setClassSettings'

const PASSWORD = 'Passw0rd!cs'
const INSTR_EMAIL = 'cs-instr@telos.test'
const INSTR2_EMAIL = 'cs-instr2@telos.test'

let instructorId: string
let classId: string

beforeAll(async () => {
  const instr = await createUser({
    role: 'instructor',
    email: INSTR_EMAIL,
    password: PASSWORD,
    fullName: 'CS Instructor',
  })
  instructorId = instr.id

  await createUser({
    role: 'instructor',
    email: INSTR2_EMAIL,
    password: PASSWORD,
    fullName: 'CS Instructor 2',
  })

  const course = await seedCourse({
    instructorId,
    code: 'CS101',
    title: 'CS Course',
  })

  const cls = await seedClass({
    instructorId,
    courseId: course.id,
    period: '1st Semester',
    sectionLabel: '1',
  })
  classId = cls.id
})

// ─── owner can update period and section label ───────────────────────────────

describe('setClassSettings — happy path', () => {
  it('owner updates period and section label; DB reflects changes', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)

    const result = await setClassSettings({
      classId,
      period: '2nd Semester',
      sectionLabel: '5',
    })
    expect(result.ok).toBe(true)

    const admin = createAdminClient()
    const { data } = await admin
      .from('classes')
      .select('period, section_label')
      .eq('id', classId)
      .single()

    expect(data?.period).toBe('2nd Semester')
    expect(data?.section_label).toBe('5')
  })
})

// ─── non-owner is rejected ───────────────────────────────────────────────────

describe('setClassSettings — authorization', () => {
  it('non-owner instructor is rejected', async () => {
    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(
      setClassSettings({ classId, period: 'Midyear', sectionLabel: '2' }),
    ).rejects.toThrow()
  })
})

// ─── invalid period is rejected ──────────────────────────────────────────────

describe('setClassSettings — validation', () => {
  it('throws /period/i for an invalid period value', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    await expect(
      setClassSettings({ classId, period: 'Spring', sectionLabel: '1' }),
    ).rejects.toThrow(/period/i)
  })

  it('throws /section/i for an empty section label', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    await expect(
      setClassSettings({ classId, period: 'Midyear', sectionLabel: '   ' }),
    ).rejects.toThrow(/section/i)
  })
})
