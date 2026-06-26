import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { getAssessmentKey } from '@/app/actions/getAssessmentKey'
import type { AnswerKeyItem } from '@/lib/types'

const PW = 'Test_pw_123!'
const tag = `akey-${Date.now()}`

let instrOwner: { id: string; email: string; password: string }
let instrOther:  { id: string; email: string; password: string }
let adminUser:   { id: string; email: string; password: string }
let student:     { id: string; email: string; password: string }
let assessmentId: string

beforeAll(async () => {
  const admin = createAdminClient()

  instrOwner = await createUser({
    role: 'instructor',
    email: `${tag}-owner@example.com`,
    password: PW,
    fullName: 'Key Owner Instructor',
  })
  instrOther = await createUser({
    role: 'instructor',
    email: `${tag}-other@example.com`,
    password: PW,
    fullName: 'Key Other Instructor',
  })
  adminUser = await createUser({
    role: 'admin',
    email: `${tag}-admin@example.com`,
    password: PW,
    fullName: 'Key Admin',
  })
  student = await createUser({
    role: 'student',
    email: `${tag}-student@example.com`,
    password: PW,
    fullName: 'Key Student',
    studentNumber: 'AK-001',
  })

  // Seed an assessment owned by instrOwner (mirrors rls.test.ts pattern)
  const { data: aRow, error: aErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instrOwner.id,
      title: 'Key Test Quiz',
      type: 'quiz',
      total_points: 2,
      questions: [
        { id: 'q1', kind: 'num',  prompt: '1+1?',        points: 1, is_bonus: false },
        { id: 'q2', kind: 'mcq',  prompt: 'Best color?', points: 1, is_bonus: false, options: ['red', 'blue', 'green'] },
      ],
    })
    .select('id')
    .single()
  if (aErr) throw aErr
  assessmentId = aRow.id

  const { error: kErr } = await admin
    .from('assessment_keys')
    .insert({
      assessment_id: assessmentId,
      answer_key: {
        q1: { value: '2',    points: 1, is_bonus: false },
        q2: { value: 'blue', points: 1, is_bonus: false },
      } as Record<string, AnswerKeyItem>,
    })
  if (kErr) throw kErr
})

describe('getAssessmentKey', () => {
  it('owning instructor receives questions + full answerKey', async () => {
    await setTestUser(instrOwner.email, PW)
    const result = await getAssessmentKey({ assessmentId })

    expect(result.title).toBe('Key Test Quiz')
    expect(result.type).toBe('quiz')
    expect(result.questions).toHaveLength(2)
    expect(result.questions[0]).toMatchObject({ id: 'q1', kind: 'num' })
    expect(result.questions[1]).toMatchObject({ id: 'q2', kind: 'mcq' })

    expect(result.answerKey).toHaveProperty('q1')
    expect(result.answerKey['q1'].value).toBe('2')
    expect(result.answerKey['q2'].value).toBe('blue')
  })

  it('non-owner instructor is rejected with Forbidden', async () => {
    await setTestUser(instrOther.email, PW)
    await expect(getAssessmentKey({ assessmentId })).rejects.toThrow(/forbidden/i)
  })

  it('student is rejected with Forbidden', async () => {
    await setTestUser(student.email, PW)
    await expect(getAssessmentKey({ assessmentId })).rejects.toThrow(/forbidden/i)
  })

  it('admin can read any assessment key regardless of ownership', async () => {
    await setTestUser(adminUser.email, PW)
    const result = await getAssessmentKey({ assessmentId })

    expect(result.title).toBe('Key Test Quiz')
    expect(result.answerKey).toHaveProperty('q1')
    expect(result.answerKey).toHaveProperty('q2')
  })
})
