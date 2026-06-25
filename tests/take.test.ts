import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUser, seedCourse, seedPeriod, seedEnrollment, seedAssignment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { importAssessment } from '@/app/actions/importAssessment'
import { getTakePayload } from '@/app/actions/getTakePayload'
import { submitAssessment } from '@/app/actions/submitAssessment'
import type { AssessmentImport } from '@/lib/types'

const quiz1: AssessmentImport = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/quiz-1.json', import.meta.url)), 'utf-8'),
)

const INSTRUCTOR_EMAIL = 'take-instr@telos.test'
const PASSWORD = 'Passw0rd!take'

// Built once: an instructor imports quiz-1, owns a course+period.
let assessmentId: string
let courseId: string
let periodId: string
let instructorId: string

// Correct answers for every key item (mcq value = option TEXT, num value = integer string).
const allAnswers: Record<string, string> = {}
for (const qid in quiz1.answer_key) allAnswers[qid] = quiz1.answer_key[qid].value
// The bonus item (q31) drives 35/30 = 116.67.
const bonusQid = Object.keys(quiz1.answer_key).find((q) => quiz1.answer_key[q].is_bonus)!
// Non-bonus-only answers => 30/30 = 100 (omit the bonus item).
const nonBonusAnswers: Record<string, string> = {}
for (const qid in quiz1.answer_key) {
  if (!quiz1.answer_key[qid].is_bonus) nonBonusAnswers[qid] = quiz1.answer_key[qid].value
}

beforeAll(async () => {
  const instr = await createUser({
    role: 'instructor',
    email: INSTRUCTOR_EMAIL,
    password: PASSWORD,
    fullName: 'Take Instructor',
  })
  instructorId = instr.id
  await setTestUser(INSTRUCTOR_EMAIL, PASSWORD)
  const imported = await importAssessment(quiz1)
  assessmentId = imported.assessmentId
  const course = await seedCourse({ instructorId, code: 'TAKE101', title: 'Take Course' })
  courseId = course.id
  const period = await seedPeriod({ courseId, instructorId, label: '1st Semester' })
  periodId = period.id
})

async function enrolledStudent(email: string) {
  const stu = await createUser({ role: 'student', email, password: PASSWORD, fullName: 'Take Student' })
  await seedEnrollment({ studentId: stu.id, courseId, periodId })
  return stu
}

describe('getTakePayload', () => {
  it('returns questions with zero answer fields, for an open assignment', async () => {
    await enrolledStudent('take-get@telos.test')
    const { id: assignmentId } = await seedAssignment({ assessmentId, courseId, periodId, instructorId })

    await setTestUser('take-get@telos.test', PASSWORD)
    const payload = await getTakePayload(assignmentId)

    expect(payload.title).toBe(quiz1.title)
    expect(payload.type).toBe(quiz1.type)
    expect(payload.questions.length).toBe(quiz1.questions.length)

    // No answer fields anywhere in the returned payload.
    const blob = JSON.stringify(payload)
    expect(blob).not.toContain('answer_key')
    expect(blob).not.toContain('correct')
    for (const q of payload.questions) {
      expect(q).not.toHaveProperty('value')
      expect(q).not.toHaveProperty('correct')
      expect(q).not.toHaveProperty('correct_index')
    }
  })
})

describe('submitAssessment', () => {
  it('grades an all-items submission INCLUDING the bonus as 35/30 = 116.67', async () => {
    await enrolledStudent('take-bonus@telos.test')
    const { id: assignmentId } = await seedAssignment({ assessmentId, courseId, periodId, instructorId })

    await setTestUser('take-bonus@telos.test', PASSWORD)
    expect(allAnswers).toHaveProperty(bonusQid)
    const res = await submitAssessment({ assignmentId, answers: allAnswers })
    expect(res.earned).toBe(35)
    expect(res.possible).toBe(30)

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data: sub } = await admin
      .from('submissions')
      .select('earned, possible, score, status, graded_at, instructor_id')
      .eq('id', res.submissionId)
      .single()
    expect(sub!.earned).toBe(35)
    expect(sub!.possible).toBe(30)
    expect(sub!.score).toBeCloseTo(116.67, 2)
    expect(sub!.status).toBe('graded')
    expect(sub!.graded_at).not.toBeNull()
    expect(sub!.instructor_id).toBe(instructorId)
  })

  it('grades a non-bonus-only submission as 30/30 = 100', async () => {
    await enrolledStudent('take-100@telos.test')
    const { id: assignmentId } = await seedAssignment({ assessmentId, courseId, periodId, instructorId })

    await setTestUser('take-100@telos.test', PASSWORD)
    const res = await submitAssessment({ assignmentId, answers: nonBonusAnswers })
    expect(res.earned).toBe(30)
    expect(res.possible).toBe(30)

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data: sub } = await admin
      .from('submissions')
      .select('score')
      .eq('id', res.submissionId)
      .single()
    expect(sub!.score).toBeCloseTo(100, 2)
  })

  it('rejects a second submission for the same student + assignment', async () => {
    await enrolledStudent('take-dup@telos.test')
    const { id: assignmentId } = await seedAssignment({ assessmentId, courseId, periodId, instructorId })

    await setTestUser('take-dup@telos.test', PASSWORD)
    await submitAssessment({ assignmentId, answers: nonBonusAnswers })
    await expect(
      submitAssessment({ assignmentId, answers: nonBonusAnswers }),
    ).rejects.toThrow(/already submitted/i)
  })

  it('rejects a submission after the window has closed', async () => {
    await enrolledStudent('take-closed@telos.test')
    const closesAt = new Date(Date.now() - 60_000).toISOString()
    const { id: assignmentId } = await seedAssignment({
      assessmentId, courseId, periodId, instructorId, closesAt,
    })

    await setTestUser('take-closed@telos.test', PASSWORD)
    await expect(
      submitAssessment({ assignmentId, answers: nonBonusAnswers }),
    ).rejects.toThrow(/not open/i)
  })
})
