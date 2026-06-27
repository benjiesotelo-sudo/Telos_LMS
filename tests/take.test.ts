import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUser, seedCourse, seedClass, seedEnrollment, seedAssignment } from '@/tests/helpers/fixtures'
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

// Built once: an instructor imports quiz-1, owns a course+class.
let assessmentId: string
let classId: string
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
  const cls = await seedClass({ instructorId, courseId: course.id, period: '1st Semester' })
  classId = cls.id
})

async function enrolledStudent(email: string) {
  const stu = await createUser({ role: 'student', email, password: PASSWORD, fullName: 'Take Student' })
  await seedEnrollment({ studentId: stu.id, classId })
  return stu
}

describe('getTakePayload [Task 8: action selects dropped course_id/period_id columns]', () => {
  it('returns questions with zero answer fields, for an open assignment', async () => {
    await enrolledStudent('take-get@telos.test')
    const { id: assignmentId } = await seedAssignment({ assessmentId, classId, instructorId })

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

describe('getTakePayload – manual assessment', () => {
  it('rejects with /manual/i when the assessment is_manual=true', async () => {
    // Insert a manual assessment directly (importAssessment does not expose is_manual).
    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data: manualA, error: maErr } = await admin
      .from('assessments')
      .insert({
        instructor_id: instructorId,
        title: 'Manual Face-to-Face HW',
        type: 'activity',
        total_points: 100,
        questions: [],
        is_manual: true,
      })
      .select('id')
      .single()
    if (maErr) throw maErr

    const { id: manualAssignId } = await seedAssignment({
      assessmentId: manualA.id,
      classId,
      instructorId,
    })

    const manualStu = await enrolledStudent('take-manual@telos.test')
    await setTestUser(manualStu.email, PASSWORD)

    await expect(getTakePayload(manualAssignId)).rejects.toThrow(/manual/i)
  })
})

describe('submitAssessment', () => {
  it('grades an all-items submission INCLUDING the bonus as 35/30 = 116.67', async () => {
    await enrolledStudent('take-bonus@telos.test')
    const { id: assignmentId } = await seedAssignment({ assessmentId, classId, instructorId })

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
    const { id: assignmentId } = await seedAssignment({ assessmentId, classId, instructorId })

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
    const { id: assignmentId } = await seedAssignment({ assessmentId, classId, instructorId })

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
      assessmentId, classId, instructorId, closesAt,
    })

    await setTestUser('take-closed@telos.test', PASSWORD)
    await expect(
      submitAssessment({ assignmentId, answers: nonBonusAnswers }),
    ).rejects.toThrow(/not open/i)
  })

  it('grades an ALL-BONUS assessment (possible=0) as score 0, not NaN', async () => {
    // total_points must equal the sum of NON-bonus points; all bonus => 0.
    const allBonus: AssessmentImport = {
      title: 'All Bonus Activity',
      type: 'activity',
      total_points: 0,
      questions: [
        {
          id: 'q1',
          kind: 'mcq',
          prompt: 'Pick the right one',
          points: 5,
          is_bonus: true,
          options: ['alpha', 'beta', 'gamma'],
        },
      ],
      answer_key: {
        q1: { value: 'beta', points: 5, is_bonus: true },
      },
    }

    await setTestUser(INSTRUCTOR_EMAIL, PASSWORD)
    const { assessmentId: bonusAssessmentId } = await importAssessment(allBonus)
    const { id: assignmentId } = await seedAssignment({
      assessmentId: bonusAssessmentId, classId, instructorId,
    })
    await enrolledStudent('take-allbonus@telos.test')

    await setTestUser('take-allbonus@telos.test', PASSWORD)
    const res = await submitAssessment({ assignmentId, answers: { q1: 'beta' } })
    expect(res.earned).toBe(5)
    expect(res.possible).toBe(0)

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data: sub } = await admin
      .from('submissions')
      .select('earned, possible, score')
      .eq('id', res.submissionId)
      .single()
    expect(sub!.earned).toBe(5)
    expect(sub!.possible).toBe(0)
    expect(sub!.score).toBe(0)
    expect(Number.isNaN(Number(sub!.score))).toBe(false)
  })
})
