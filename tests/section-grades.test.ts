// tests/section-grades.test.ts
//
// Integration tests for getSectionGrades (FEU gradebook assembly).
//
// Hand-computed expected values (Student A, all-midterm, default weights 30/20/50):
//   Quiz cell:     80/100 × 100 = 80%
//   Activity cell: override=75  (auto score 50/100×100=50% is overridden)
//   Exam cell:     90/100 × 100 = 90%
//
//   quizzes avg  = categoryAverage([80]) = 80
//   papers avg   = categoryAverage([75]) = 75
//   exam avg     = categoryAverage([90]) = 90
//
//   midtermMark  = 80×0.30 + 75×0.20 + 90×0.50
//                = 24 + 15 + 45 = 84
//
//   finalMark    = null  (no final-period assignments)
//
//   courseMark   = courseMark(84, null) = 84  (one-period pass-through)
//   letter       = gradeFor(84) → Math.round(84)=84 → 78–84 → B / 3.0

import { describe, it, expect, beforeAll } from 'vitest'
import {
  createUser,
  seedCourse,
  seedClass,
  seedEnrollment,
} from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { setGradeOverride } from '@/app/actions/setGradeOverride'
import { getSectionGrades } from '@/app/actions/getSectionGrades'
import { categoryAverage, periodMark, courseMark, gradeFor } from '@/lib/gradebook'

const PASSWORD = 'Passw0rd!sg'
const INSTR_EMAIL  = 'sg-instr@telos.test'
const INSTR2_EMAIL = 'sg-instr2@telos.test'

let instructorId: string
let classId: string
let studentAId: string
let studentBId: string
let quizAssessmentId: string
let activityAssessmentId: string
let examAssessmentId: string

beforeAll(async () => {
  // ── Users ─────────────────────────────────────────────────────────────────
  const instr = await createUser({
    role: 'instructor',
    email: INSTR_EMAIL,
    password: PASSWORD,
    fullName: 'SG Instructor',
  })
  instructorId = instr.id

  await createUser({
    role: 'instructor',
    email: INSTR2_EMAIL,
    password: PASSWORD,
    fullName: 'SG Instructor 2',
  })

  const stuA = await createUser({
    role: 'student',
    email: 'sg-student-a@telos.test',
    password: PASSWORD,
    fullName: 'SG Student A',
    studentNumber: 'SG20240001',
  })
  studentAId = stuA.id

  const stuB = await createUser({
    role: 'student',
    email: 'sg-student-b@telos.test',
    password: PASSWORD,
    fullName: 'SG Student B',
    studentNumber: 'SG20240002',
  })
  studentBId = stuB.id

  // ── Class setup ───────────────────────────────────────────────────────────
  const course = await seedCourse({ instructorId, code: 'SG101', title: 'SG Course' })
  const cls    = await seedClass({
    instructorId,
    courseId: course.id,
    period: '1st Semester',
  })
  classId = cls.id

  await seedEnrollment({ studentId: studentAId, classId })
  await seedEnrollment({ studentId: studentBId, classId })

  // ── Seed assessments + assignments + submissions via admin ─────────────────
  // Using the admin client directly so we don't need to invoke importAssessment
  // (which would require auth context for each type and is not what we're testing).
  const admin = (await import('@/lib/supabase/server')).createAdminClient()

  // Assessments
  const { data: qRow, error: qErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instructorId,
      title: 'SG Quiz 1',
      type: 'quiz',
      total_points: 100,
      questions: [],
    })
    .select('id')
    .single()
  if (qErr) throw qErr
  quizAssessmentId = qRow!.id

  const { data: aRow, error: aErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instructorId,
      title: 'SG HW 1',
      type: 'activity',
      total_points: 100,
      questions: [],
    })
    .select('id')
    .single()
  if (aErr) throw aErr
  activityAssessmentId = aRow!.id

  const { data: eRow, error: eErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instructorId,
      title: 'SG Exam 1',
      type: 'exam',
      total_points: 100,
      questions: [],
    })
    .select('id')
    .single()
  if (eErr) throw eErr
  examAssessmentId = eRow!.id

  // Assignments (all midterm)
  const { data: qaRow, error: qaErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: quizAssessmentId,
      class_id: classId,
      instructor_id: instructorId,
      period: 'midterm',
    })
    .select('id')
    .single()
  if (qaErr) throw qaErr
  const quizAssignmentId = qaRow!.id

  const { data: aaRow, error: aaErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: activityAssessmentId,
      class_id: classId,
      instructor_id: instructorId,
      period: 'midterm',
    })
    .select('id')
    .single()
  if (aaErr) throw aaErr
  const activityAssignmentId = aaRow!.id

  const { data: eaRow, error: eaErr } = await admin
    .from('assignments')
    .insert({
      assessment_id: examAssessmentId,
      class_id: classId,
      instructor_id: instructorId,
      period: 'midterm',
    })
    .select('id')
    .single()
  if (eaErr) throw eaErr
  const examAssignmentId = eaRow!.id

  // Submissions for Student A:
  //   Quiz:     earned=80, possible=100 → 80%
  //   Activity: earned=50, possible=100 → 50%  (will be overridden to 75)
  //   Exam:     earned=90, possible=100 → 90%
  const now = new Date().toISOString()
  const { error: s1Err } = await admin.from('submissions').insert({
    assignment_id: quizAssignmentId,
    student_id: studentAId,
    instructor_id: instructorId,
    answers: {},
    earned: 80,
    possible: 100,
    score: 80,
    status: 'graded',
    graded_at: now,
  })
  if (s1Err) throw s1Err

  const { error: s2Err } = await admin.from('submissions').insert({
    assignment_id: activityAssignmentId,
    student_id: studentAId,
    instructor_id: instructorId,
    answers: {},
    earned: 50,
    possible: 100,
    score: 50,
    status: 'graded',
    graded_at: now,
  })
  if (s2Err) throw s2Err

  const { error: s3Err } = await admin.from('submissions').insert({
    assignment_id: examAssignmentId,
    student_id: studentAId,
    instructor_id: instructorId,
    answers: {},
    earned: 90,
    possible: 100,
    score: 90,
    status: 'graded',
    graded_at: now,
  })
  if (s3Err) throw s3Err

  // Grade override for Student A on the activity: score=75 > auto 50
  await setTestUser(INSTR_EMAIL, PASSWORD)
  await setGradeOverride({
    studentId: studentAId,
    assessmentId: activityAssessmentId,
    classId,
    score: 75,
    note: 'Paper graded offline',
  })
})

// ─── Non-owner guard ─────────────────────────────────────────────────────────

describe('getSectionGrades — authorization', () => {
  it('non-owner instructor is rejected', async () => {
    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(getSectionGrades({ classId })).rejects.toThrow()
  })
})

// ─── Cell values ─────────────────────────────────────────────────────────────

describe('getSectionGrades — cell values', () => {
  it('manual override (75) beats the auto-graded submission (50) for the activity cell', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getSectionGrades({ classId })
    const stuA = result.students.find((s) => s.studentId === studentAId)!

    expect(stuA.cells[quizAssessmentId]).toBe(80)
    expect(stuA.cells[activityAssessmentId]).toBe(75)   // override wins over 50
    expect(stuA.cells[examAssessmentId]).toBe(90)
  })

  it('Student B (no submissions, no overrides) has all null cells', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getSectionGrades({ classId })
    const stuB = result.students.find((s) => s.studentId === studentBId)!

    expect(stuB.cells[quizAssessmentId]).toBeNull()
    expect(stuB.cells[activityAssessmentId]).toBeNull()
    expect(stuB.cells[examAssessmentId]).toBeNull()
  })
})

// ─── Grade computation ───────────────────────────────────────────────────────

describe('getSectionGrades — grade computation', () => {
  it('Student A: correct midterm mark, course mark, and letter (B/3.0)', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getSectionGrades({ classId })
    const stuA = result.students.find((s) => s.studentId === studentAId)!

    // Hand-computed reference using lib/gradebook (not re-derived math):
    //   quizzes avg  = 80, papers avg = 75, exam avg = 90
    //   midtermMark  = 80×0.30 + 75×0.20 + 90×0.50 = 84
    const expectedMidterm = periodMark(
      {
        quizzes: categoryAverage([80]),
        papers:  categoryAverage([75]),
        exam:    categoryAverage([90]),
      },
      { wtQuiz: 0.30, wtPaper: 0.20, wtExam: 0.50 },
    ) // → 84

    expect(stuA.midtermMark).toBe(expectedMidterm)   // 84

    // No final assignments → finalMark = null
    expect(stuA.finalMark).toBeNull()

    // courseMark(84, null) = 84  (one-period pass-through per spec)
    const expectedCourse = courseMark(expectedMidterm!, null)   // → 84
    expect(stuA.courseMark).toBe(expectedCourse)

    // gradeFor(84) → mark=84 → 78–84 → B / 3.0
    const expectedGrade = gradeFor(expectedCourse)!
    expect(stuA.letter).toBe(expectedGrade.letter)   // 'B'
    expect(stuA.qp).toBe(expectedGrade.qp)           // 3.0
  })

  it('Student B (all null cells) has null period marks, course mark, and no letter', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getSectionGrades({ classId })
    const stuB = result.students.find((s) => s.studentId === studentBId)!

    expect(stuB.midtermMark).toBeNull()
    expect(stuB.finalMark).toBeNull()
    expect(stuB.courseMark).toBeNull()
    expect(stuB.letter).toBeNull()
    expect(stuB.qp).toBeNull()
  })
})

// ─── Structure ───────────────────────────────────────────────────────────────

describe('getSectionGrades — returned structure', () => {
  it('returns correct class metadata (id, weights, displayName prefix)', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getSectionGrades({ classId })

    expect(result.class.id).toBe(classId)
    expect(result.class.weights).toEqual({ wtQuiz: 0.30, wtPaper: 0.20, wtExam: 0.50 })
    // displayName format: "<courseCode> - <sectionLabel>"
    expect(result.class.displayName).toMatch(/SG101/)
  })

  it('returns three assessment columns with correct types and periods', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getSectionGrades({ classId })

    expect(result.assessments).toHaveLength(3)

    const quizMeta = result.assessments.find((a) => a.assessmentId === quizAssessmentId)!
    expect(quizMeta).toBeDefined()
    expect(quizMeta.type).toBe('quiz')
    expect(quizMeta.period).toBe('midterm')

    const actMeta = result.assessments.find((a) => a.assessmentId === activityAssessmentId)!
    expect(actMeta).toBeDefined()
    expect(actMeta.type).toBe('activity')
    expect(actMeta.period).toBe('midterm')

    const examMeta = result.assessments.find((a) => a.assessmentId === examAssessmentId)!
    expect(examMeta).toBeDefined()
    expect(examMeta.type).toBe('exam')
    expect(examMeta.period).toBe('midterm')
  })

  it('returns both enrolled students with correct profile info', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const result = await getSectionGrades({ classId })

    const ids = result.students.map((s) => s.studentId)
    expect(ids).toContain(studentAId)
    expect(ids).toContain(studentBId)

    const stuA = result.students.find((s) => s.studentId === studentAId)!
    expect(stuA.fullName).toBe('SG Student A')
    expect(stuA.studentNumber).toBe('SG20240001')

    const stuB = result.students.find((s) => s.studentId === studentBId)!
    expect(stuB.fullName).toBe('SG Student B')
    expect(stuB.studentNumber).toBe('SG20240002')
  })
})
