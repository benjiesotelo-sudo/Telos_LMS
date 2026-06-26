// tests/class-detail.test.ts
//
// TDD integration tests for getClassDetail and setClassWeights.
//
// RED → GREEN cycle: write tests first, watch them fail (no action files yet),
// then implement the actions to make them pass.

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createUser,
  seedCourse,
  seedClass,
  seedEnrollment,
} from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { getClassDetail } from '@/app/actions/getClassDetail'
import { setClassWeights } from '@/app/actions/setClassWeights'

const PASSWORD = 'Passw0rd!cd'
const INSTR_EMAIL = 'cd-instr@telos.test'
const INSTR2_EMAIL = 'cd-instr2@telos.test'

let instructorId: string
let classId: string
let studentId: string
let assignmentId: string
let assessmentId: string

beforeAll(async () => {
  // ── Users ─────────────────────────────────────────────────────────────────
  const instr = await createUser({
    role: 'instructor',
    email: INSTR_EMAIL,
    password: PASSWORD,
    fullName: 'CD Instructor',
  })
  instructorId = instr.id

  await createUser({
    role: 'instructor',
    email: INSTR2_EMAIL,
    password: PASSWORD,
    fullName: 'CD Instructor 2',
  })

  const stu = await createUser({
    role: 'student',
    email: 'cd-student@telos.test',
    password: PASSWORD,
    fullName: 'CD Student',
    studentNumber: 'CD20240001',
  })
  studentId = stu.id

  // ── Class setup ───────────────────────────────────────────────────────────
  const course = await seedCourse({ instructorId, code: 'CD101', title: 'CD Course' })
  const cls = await seedClass({
    instructorId,
    courseId: course.id,
    period: '1st Semester',
    sectionLabel: 'A',
    pic: 'Dr. Smith',
  })
  classId = cls.id

  await seedEnrollment({ studentId, classId })

  // ── Seed assessment + assignment via admin ────────────────────────────────
  const admin = (await import('@/lib/supabase/server')).createAdminClient()

  const { data: asmtRow, error: asmtErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instructorId,
      title: 'CD Quiz 1',
      type: 'quiz',
      total_points: 100,
      questions: [],
    })
    .select('id')
    .single()
  if (asmtErr) throw asmtErr
  assessmentId = asmtRow!.id

  const { data: assignRow, error: assignErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: assessmentId,
      class_id: classId,
      instructor_id: instructorId,
      period: 'midterm',
      active: true,
      reveal_answers: false,
    })
    .select('id')
    .single()
  if (assignErr) throw assignErr
  assignmentId = assignRow!.id
})

// ─── getClassDetail — authorization ─────────────────────────────────────────

describe('getClassDetail — authorization', () => {
  it('non-owner instructor is rejected', async () => {
    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(getClassDetail({ classId })).rejects.toThrow()
  })
})

// ─── getClassDetail — class metadata ────────────────────────────────────────

describe('getClassDetail — class metadata', () => {
  it('returns correct class metadata for the owner', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getClassDetail({ classId })

    expect(result.class.id).toBe(classId)
    expect(result.class.displayName).toMatch(/CD101/)
    expect(result.class.code).toBe('CD101')
    expect(result.class.title).toBe('CD Course')
    expect(result.class.period).toBe('1st Semester')
    expect(result.class.sectionLabel).toBe('A')
    expect(result.class.pic).toBe('Dr. Smith')
    expect(result.class.weights).toMatchObject({
      wtQuiz: expect.any(Number),
      wtPaper: expect.any(Number),
      wtExam: expect.any(Number),
    })
  })
})

// ─── getClassDetail — assessments ───────────────────────────────────────────

describe('getClassDetail — assessments', () => {
  it('returns the assignment row with assessment details', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getClassDetail({ classId })

    expect(result.assessments).toHaveLength(1)
    const asmt = result.assessments[0]
    expect(asmt.assignmentId).toBe(assignmentId)
    expect(asmt.assessmentId).toBe(assessmentId)
    expect(asmt.title).toBe('CD Quiz 1')
    expect(asmt.type).toBe('quiz')
    expect(asmt.period).toBe('midterm')
    expect(asmt.active).toBe(true)
    expect(asmt.revealAnswers).toBe(false)
    // deadline fields present (may be null)
    expect('opensAt' in asmt).toBe(true)
    expect('closesAt' in asmt).toBe(true)
    expect('dueDate' in asmt).toBe(true)
  })
})

// ─── getClassDetail — students ───────────────────────────────────────────────

describe('getClassDetail — students', () => {
  it('returns enrolled students with full profile info', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getClassDetail({ classId })

    expect(result.students).toHaveLength(1)
    const stu = result.students[0]
    expect(stu.studentId).toBe(studentId)
    expect(stu.fullName).toBe('CD Student')
    expect(stu.studentNumber).toBe('CD20240001')
    expect(stu.email).toBe('cd-student@telos.test')
    expect(stu.status).toBeDefined()
  })
})

// ─── setClassWeights ─────────────────────────────────────────────────────────

describe('setClassWeights', () => {
  it('owner can update weights when they sum to 1.0', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await setClassWeights({ classId, wtQuiz: 0.3, wtPaper: 0.2, wtExam: 0.5 })
    expect(result.ok).toBe(true)

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data } = await admin
      .from('classes')
      .select('wt_quiz, wt_paper, wt_exam')
      .eq('id', classId)
      .single()
    expect(Number(data!.wt_quiz)).toBeCloseTo(0.3)
    expect(Number(data!.wt_paper)).toBeCloseTo(0.2)
    expect(Number(data!.wt_exam)).toBeCloseTo(0.5)
  })

  it('throws with /sum/i when weights do not total 1.0', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    await expect(
      setClassWeights({ classId, wtQuiz: 0.3, wtPaper: 0.3, wtExam: 0.3 }),
    ).rejects.toThrow(/sum/i)
  })

  it('non-owner is rejected', async () => {
    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(
      setClassWeights({ classId, wtQuiz: 0.3, wtPaper: 0.2, wtExam: 0.5 }),
    ).rejects.toThrow()
  })
})
