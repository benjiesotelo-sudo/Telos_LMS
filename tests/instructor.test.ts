import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser, signInAs } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedPeriod, seedAssignment, seedEnrollment } from '@/tests/helpers/fixtures'
import { createAssignment } from '@/app/actions/createAssignment'
import { importAssessment } from '@/app/actions/importAssessment'
import { submitAssessment } from '@/app/actions/submitAssessment'
import { computeFinal } from '@/lib/grading'
import type { AssessmentImport, ComponentSubmission, ComponentWeights } from '@/lib/types'

const PW = 'Passw0rd!test'
const DEFAULT_WEIGHTS: ComponentWeights = { activity: 10, quiz: 40, exam: 50 }

describe('createAssignment derives instructor_id from course owner', () => {
  let instructorId: string
  let ownerEmail: string
  let assessmentId: string
  let courseId: string
  let periodId: string

  beforeAll(async () => {
    ownerEmail = `inst-assign-${Date.now()}@telos.test`
    const owner = await createUser({ role: 'instructor', email: ownerEmail, password: PW, fullName: 'Owner Inst' })
    instructorId = owner.id
    const course = await seedCourse({ instructorId, code: 'AMS0011', title: 'Algebra & Trig' })
    courseId = course.id
    const period = await seedPeriod({ courseId, instructorId, label: '1st Semester' })
    periodId = period.id
    await setTestUser(ownerEmail, PW)
    const json: AssessmentImport = {
      title: 'A1', type: 'activity', total_points: 1,
      questions: [{ id: 'q1', kind: 'num', prompt: '1+1?', points: 1, is_bonus: false }],
      answer_key: { q1: { value: '2', points: 1, is_bonus: false } },
    }
    const imp = await importAssessment(json)
    assessmentId = imp.assessmentId
  })

  it('sets instructor_id to the course owner', async () => {
    await setTestUser(ownerEmail, PW)
    const res = await createAssignment({ assessmentId, courseId, periodId, pic: 'Owner Inst' })
    expect(res.assignmentId).toBeTruthy()
    const admin = createAdminClient()
    const { data } = await admin.from('assignments').select('instructor_id, pic').eq('id', res.assignmentId).single()
    expect(data!.instructor_id).toBe(instructorId)
    expect(data!.pic).toBe('Owner Inst')
  })

  it('rejects a periodId that belongs to a different course', async () => {
    // second course (same owner) + a period under THAT second course
    const otherCourse = await seedCourse({ instructorId, code: 'AMS0012', title: 'Other Course' })
    const foreignPeriod = await seedPeriod({ courseId: otherCourse.id, instructorId, label: '2nd Semester' })
    await setTestUser(ownerEmail, PW)
    // courseId = first course, but periodId belongs to the second course -> must reject
    await expect(
      createAssignment({ assessmentId, courseId, periodId: foreignPeriod.id, pic: 'Owner Inst' }),
    ).rejects.toThrow(/period/i)
  })
})

describe('submissions roster is RLS-scoped to the owning instructor', () => {
  let aId: string, aEmail: string
  let bEmail: string
  let aSubmissionId: string, bSubmissionId: string

  async function seedGradedSubmission(instructorEmail: string, instructorId: string): Promise<{ submissionId: string }> {
    const course = await seedCourse({ instructorId, code: 'AMS0011', title: 'AT' })
    const period = await seedPeriod({ courseId: course.id, instructorId, label: '1st Semester' })
    await setTestUser(instructorEmail, PW)
    const json: AssessmentImport = {
      title: 'Q', type: 'quiz', total_points: 2,
      questions: [{ id: 'q1', kind: 'num', prompt: '2+2?', points: 2, is_bonus: false }],
      answer_key: { q1: { value: '4', points: 2, is_bonus: false } },
    }
    const imp = await importAssessment(json)
    const asg = await seedAssignment({ assessmentId: imp.assessmentId, courseId: course.id, periodId: period.id, instructorId })
    const stu = await createUser({ role: 'student', email: `stu-${instructorId}-${Date.now()}@telos.test`, password: PW, fullName: 'Stu' })
    await seedEnrollment({ studentId: stu.id, courseId: course.id, periodId: period.id })
    await setTestUser(stu.email, PW)
    const sub = await submitAssessment({ assignmentId: asg.id, answers: { q1: '4' } })
    return { submissionId: sub.submissionId }
  }

  beforeAll(async () => {
    aEmail = `inst-a-${Date.now()}@telos.test`
    bEmail = `inst-b-${Date.now()}@telos.test`
    const a = await createUser({ role: 'instructor', email: aEmail, password: PW, fullName: 'Inst A' })
    const b = await createUser({ role: 'instructor', email: bEmail, password: PW, fullName: 'Inst B' })
    aId = a.id
    aSubmissionId = (await seedGradedSubmission(aEmail, aId)).submissionId
    bSubmissionId = (await seedGradedSubmission(bEmail, b.id)).submissionId
  })

  it('instructor A reads only A submissions, never B', async () => {
    const { client } = await signInAs(aEmail, PW)
    const { data, error } = await client.from('submissions').select('id, instructor_id, earned, possible, score')
    expect(error).toBeNull()
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(aSubmissionId)
    expect(ids).not.toContain(bSubmissionId)
    for (const row of data ?? []) expect(row.instructor_id).toBe(aId)
  })
})

describe('per-student computeFinal rollup matches foundation parity', () => {
  it('Scenario A: final 79.5, complete', () => {
    const subs: ComponentSubmission[] = [
      { type: 'activity', earned: 90, possible: 120 },
      { type: 'quiz', earned: 44, possible: 55 },
      { type: 'exam', earned: 40, possible: 50 },
    ]
    const r = computeFinal(subs, DEFAULT_WEIGHTS)
    expect(r.final).toBeCloseTo(79.5, 10)
    expect(r.complete).toBe(true)
    expect(r.components.activity.pct).toBeCloseTo(75, 10)
    expect(r.components.quiz.pct).toBeCloseTo(80, 10)
    expect(r.components.exam.pct).toBeCloseTo(80, 10)
  })

  it('Scenario B: exam missing -> partial 39.5, provisional 79.0, incomplete', () => {
    const subs: ComponentSubmission[] = [
      { type: 'activity', earned: 90, possible: 120 },
      { type: 'quiz', earned: 44, possible: 55 },
    ]
    const r = computeFinal(subs, DEFAULT_WEIGHTS)
    expect(r.final).toBeCloseTo(39.5, 10)
    expect(r.provisional).toBeCloseTo(79.0, 10)
    expect(r.complete).toBe(false)
    expect(r.components.exam.pct).toBeNull()
  })
})
