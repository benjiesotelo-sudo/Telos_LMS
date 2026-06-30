/**
 * tests/answer-reveal.test.ts — Task 9: student answer reveal gate
 *
 * Verifies that getRevealedAnswers:
 *  ✓ returns correct answers when reveal_answers=true + closed + graded (owning student)
 *  ✓ returns null when reveal_answers=false (even if closed + graded)
 *  ✓ returns null when not yet closed (closes_at in the future) even if reveal_answers=true
 *  ✓ returns null when submission is not yet graded
 *  ✓ throws /forbidden/i when a DIFFERENT student requests the reveal
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { getRevealedAnswers } from '@/app/actions/getRevealedAnswers'
import type { AnswerKeyItem } from '@/lib/types'

const PW = 'Test_pw_123!'
const tag = `reveal-${Date.now()}`

// Shared instructor + assessment data
let instructorId: string
let assessmentId: string          // type 'quiz'
let activityAssessmentId: string  // type 'activity' (homework)
let classId: string

// Students (one per scenario)
let stuOwner: { id: string; email: string; password: string }
let stuOther: { id: string; email: string; password: string }

const QUESTIONS = [
  { id: 'q1', kind: 'num' as const,  prompt: '1+1?', points: 1, is_bonus: false },
  { id: 'q2', kind: 'mcq' as const,  prompt: 'Color?', points: 1, is_bonus: false, options: ['red', 'blue'] },
]
const ANSWER_KEY: Record<string, AnswerKeyItem> = {
  q1: { value: '2', points: 1, is_bonus: false },
  q2: { value: 'blue', points: 1, is_bonus: false },
}
const STUDENT_ANSWERS = { q1: '2', q2: 'blue' }

// ─── helper: seed an assignment + a graded submission ────────────────────────

async function seedScenario(opts: {
  studentId: string
  revealAnswers: boolean
  closesAt: string | null // past ISO string = closed; future ISO = still open; null = no closes_at
  status: 'graded' | 'submitted' | 'in_progress'
  assessmentId?: string   // defaults to the shared quiz assessment
}): Promise<string> {
  const admin = createAdminClient()

  // Insert assignment
  const { data: asgRow, error: asgErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: opts.assessmentId ?? assessmentId,
      class_id: classId,
      instructor_id: instructorId,
      reveal_answers: opts.revealAnswers,
      closes_at: opts.closesAt ?? null,
    })
    .select('id')
    .single()
  if (asgErr) throw asgErr

  // Insert submission with the requested status
  const { data: subRow, error: subErr } = await admin
    .from('submissions')
    .insert({
      assignment_id: asgRow.id,
      student_id: opts.studentId,
      instructor_id: instructorId,
      answers: STUDENT_ANSWERS,
      earned: 2,
      possible: 2,
      score: 100,
      status: opts.status,
      graded_at: opts.status === 'graded' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (subErr) throw subErr

  return subRow.id
}

// ─── beforeAll: create instructor + assessment + two students ─────────────────

beforeAll(async () => {
  const admin = createAdminClient()

  const instr = await createUser({
    role: 'instructor',
    email: `${tag}-instr@example.com`,
    password: PW,
    fullName: 'Reveal Instructor',
  })
  instructorId = instr.id

  stuOwner = await createUser({
    role: 'student',
    email: `${tag}-owner@example.com`,
    password: PW,
    fullName: 'Reveal Owner Student',
    studentNumber: 'RV-001',
  })

  stuOther = await createUser({
    role: 'student',
    email: `${tag}-other@example.com`,
    password: PW,
    fullName: 'Reveal Other Student',
    studentNumber: 'RV-002',
  })

  // Create a course + class for the instructor
  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'Reveal Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: '1st Semester' })
  classId = cls.id

  // Seed an assessment + key owned by the instructor
  const { data: aRow, error: aErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instructorId,
      title: 'Reveal Test Quiz',
      type: 'quiz',
      total_points: 2,
      questions: QUESTIONS,
    })
    .select('id')
    .single()
  if (aErr) throw aErr
  assessmentId = aRow.id

  const { error: kErr } = await admin
    .from('assessment_keys')
    .insert({ assessment_id: assessmentId, answer_key: ANSWER_KEY })
  if (kErr) throw kErr

  // Seed a SECOND assessment of type 'activity' (homework) + key, for the
  // type-aware reveal tests (homework reveals immediately, no close required).
  const { data: actRow, error: actErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instructorId,
      title: 'Reveal Test Homework',
      type: 'activity',
      total_points: 2,
      questions: QUESTIONS,
    })
    .select('id')
    .single()
  if (actErr) throw actErr
  activityAssessmentId = actRow.id

  const { error: ak2Err } = await admin
    .from('assessment_keys')
    .insert({ assessment_id: activityAssessmentId, answer_key: ANSWER_KEY })
  if (ak2Err) throw ak2Err
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getRevealedAnswers', () => {
  // 1. Happy path: reveal=true + closed + graded → owning student gets the key
  it('returns questions + correctAnswers + myAnswers when reveal=true, closed, graded', async () => {
    const pastClose = new Date(Date.now() - 60_000).toISOString()
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: true,
      closesAt: pastClose,
      status: 'graded',
    })

    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })

    expect(result).not.toBeNull()
    expect(result!.questions).toHaveLength(2)
    expect(result!.correctAnswers).toHaveProperty('q1')
    expect(result!.correctAnswers['q1'].value).toBe('2')
    expect(result!.correctAnswers['q2'].value).toBe('blue')
    expect(result!.myAnswers).toMatchObject(STUDENT_ANSWERS)
  })

  // 2. reveal=false → null even when closed + graded
  it('returns null when reveal_answers=false (even if closed + graded)', async () => {
    const pastClose = new Date(Date.now() - 60_000).toISOString()
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: false,
      closesAt: pastClose,
      status: 'graded',
    })

    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })
    expect(result).toBeNull()
  })

  // 3. reveal=true but closes_at is in the future → null
  it('returns null when not yet closed (closes_at in the future) even if reveal=true', async () => {
    const futureClose = new Date(Date.now() + 3_600_000).toISOString()
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: true,
      closesAt: futureClose,
      status: 'graded',
    })

    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })
    expect(result).toBeNull()
  })

  // 4. reveal=true + closed but not graded → null
  it('returns null when submission is not graded (status=submitted)', async () => {
    const pastClose = new Date(Date.now() - 60_000).toISOString()
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: true,
      closesAt: pastClose,
      status: 'submitted',
    })

    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })
    expect(result).toBeNull()
  })

  // 5. A DIFFERENT student trying to read another student's submission → Forbidden
  it('throws /forbidden/i when a different student requests this submission', async () => {
    const pastClose = new Date(Date.now() - 60_000).toISOString()
    const submissionId = await seedScenario({
      studentId: stuOwner.id,   // belongs to stuOwner
      revealAnswers: true,
      closesAt: pastClose,
      status: 'graded',
    })

    // stuOther (different student) tries to access stuOwner's reveal
    await setTestUser(stuOther.email, PW)
    await expect(getRevealedAnswers({ submissionId })).rejects.toThrow(/forbidden/i)
  })
})

// ─── Close gate (SAME for every type): reveal when no close is set OR a set close has ──
//     passed; only a FUTURE close holds answers back. Activity behaves like quiz now. ────

describe('getRevealedAnswers — close gate', () => {
  it('ACTIVITY: reveals immediately when graded + reveal=true and NO close date', async () => {
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: true,
      closesAt: null,            // no close date
      status: 'graded',
      assessmentId: activityAssessmentId,
    })
    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })
    expect(result).not.toBeNull()
    expect(result!.correctAnswers['q1'].value).toBe('2')
  })

  it('ACTIVITY: a FUTURE close date now holds answers back too (same as quiz)', async () => {
    const futureClose = new Date(Date.now() + 3_600_000).toISOString()
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: true,
      closesAt: futureClose,
      status: 'graded',
      assessmentId: activityAssessmentId,
    })
    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })
    expect(result).toBeNull()
  })

  it('QUIZ: reveals immediately when graded + reveal=true and NO close date set', async () => {
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: true,
      closesAt: null,            // quiz with no close → reveals immediately (new rule)
      status: 'graded',
    })
    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })
    expect(result).not.toBeNull()
    expect(result!.correctAnswers['q1'].value).toBe('2')
  })

  it('QUIZ: a FUTURE close date still holds answers back (returns null)', async () => {
    const futureClose = new Date(Date.now() + 3_600_000).toISOString()
    const submissionId = await seedScenario({
      studentId: stuOwner.id,
      revealAnswers: true,
      closesAt: futureClose,
      status: 'graded',
    })
    await setTestUser(stuOwner.email, PW)
    const result = await getRevealedAnswers({ submissionId })
    expect(result).toBeNull()
  })
})
