// tests/quiz-timer.test.ts — Theme D quiz timer (startAttempt + setAssessmentDuration)
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass, seedAssignment, seedEnrollment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { startAttempt, getAttemptStatus } from '@/app/actions/startAttempt'
import { setAssessmentDuration } from '@/app/actions/setAssessmentDuration'

const PW = 'Timer_pw_123!'
const tag = `tmr-${Date.now()}`

let instructorId: string
let studentId: string
let classId: string
let timedAsgId: string      // duration via assessment default (30)
let overrideAsgId: string   // assignment duration_minutes=10 overrides default
let untimedAsgId: string    // no duration anywhere
let durAssessmentId: string // assessment with default_duration_minutes=30

beforeAll(async () => {
  const admin = createAdminClient()
  const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'Tmr Instr' })
  instructorId = instr.id
  const stu = await createUser({ role: 'student', email: `${tag}-s@x.com`, password: PW, fullName: 'Tmr Stu', studentNumber: 'T-1' })
  studentId = stu.id
  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'Tmr Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: 'Midyear' })
  classId = cls.id
  await seedEnrollment({ studentId, classId })

  // Timed-by-default assessment (30 min)
  const { data: durA } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'Timed Quiz', type: 'quiz', total_points: 5, questions: [], default_duration_minutes: 30 }).select('id').single()
  durAssessmentId = durA!.id
  timedAsgId = (await seedAssignment({ assessmentId: durAssessmentId, classId, instructorId })).id

  // Assignment that overrides the default with 10 min
  const ov = await seedAssignment({ assessmentId: durAssessmentId, classId, instructorId })
  overrideAsgId = ov.id
  await admin.from('assignments').update({ duration_minutes: 10 }).eq('id', overrideAsgId)

  // Untimed assessment + assignment
  const { data: unA } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'Untimed Quiz', type: 'quiz', total_points: 5, questions: [] }).select('id').single()
  untimedAsgId = (await seedAssignment({ assessmentId: unA!.id, classId, instructorId })).id
})

describe('startAttempt', () => {
  it('timed-by-default: returns timed=30 and a deadline ~30 min out', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    const r = await startAttempt({ assignmentId: timedAsgId })
    expect(r.timed).toBe(true)
    expect(r.durationMinutes).toBe(30)
    expect(r.startedAt).not.toBeNull()
    const mins = (new Date(r.deadline!).getTime() - new Date(r.startedAt!).getTime()) / 60000
    expect(Math.round(mins)).toBe(30)
  })

  it('keeps running: a second call returns the SAME start time (no reset)', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    const first = await startAttempt({ assignmentId: timedAsgId })
    const second = await startAttempt({ assignmentId: timedAsgId })
    expect(second.startedAt).toBe(first.startedAt)
    expect(second.deadline).toBe(first.deadline)
  })

  it('assignment duration overrides the assessment default (10 not 30)', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    const r = await startAttempt({ assignmentId: overrideAsgId })
    expect(r.durationMinutes).toBe(10)
  })

  it('untimed assignment → timed=false, no deadline', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    const r = await startAttempt({ assignmentId: untimedAsgId })
    expect(r.timed).toBe(false)
    expect(r.deadline).toBeNull()
  })

  it('a non-enrolled student is rejected', async () => {
    const outsider = await createUser({ role: 'student', email: `${tag}-out@x.com`, password: PW, fullName: 'Outsider', studentNumber: 'T-9' })
    void outsider
    await setTestUser(`${tag}-out@x.com`, PW)
    await expect(startAttempt({ assignmentId: timedAsgId })).rejects.toThrow()
  })
})

describe('getAttemptStatus (read-only, for the pre-quiz screen)', () => {
  it('untimed assignment → timed=false', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    const s = await getAttemptStatus({ assignmentId: untimedAsgId })
    expect(s.timed).toBe(false)
    expect(s.started).toBe(false)
  })

  it('timed assignment: not started before startAttempt, started after (does not itself record a start)', async () => {
    const admin = createAdminClient()
    const fresh = await seedAssignment({ assessmentId: durAssessmentId, classId, instructorId })
    void admin

    await setTestUser(`${tag}-s@x.com`, PW)
    const before = await getAttemptStatus({ assignmentId: fresh.id })
    expect(before.timed).toBe(true)
    expect(before.started).toBe(false)
    expect(before.deadline).toBeNull()

    // peeking again must NOT have started it
    const stillBefore = await getAttemptStatus({ assignmentId: fresh.id })
    expect(stillBefore.started).toBe(false)

    await startAttempt({ assignmentId: fresh.id })
    const after = await getAttemptStatus({ assignmentId: fresh.id })
    expect(after.started).toBe(true)
    expect(after.deadline).not.toBeNull()
  })
})

describe('setAssessmentDuration', () => {
  it('owner sets + clears the default duration', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await setAssessmentDuration({ assessmentId: durAssessmentId, minutes: 45 })
    const admin = createAdminClient()
    let { data } = await admin.from('assessments').select('default_duration_minutes').eq('id', durAssessmentId).single()
    expect(data!.default_duration_minutes).toBe(45)

    await setAssessmentDuration({ assessmentId: durAssessmentId, minutes: null })
    ;({ data } = await admin.from('assessments').select('default_duration_minutes').eq('id', durAssessmentId).single())
    expect(data!.default_duration_minutes).toBeNull()

    // restore for other tests in this file run order independence
    await setAssessmentDuration({ assessmentId: durAssessmentId, minutes: 30 })
  })

  it('a non-owner is rejected', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    await expect(setAssessmentDuration({ assessmentId: durAssessmentId, minutes: 5 })).rejects.toThrow()
  })
})
