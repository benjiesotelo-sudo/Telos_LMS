// tests/student-data.test.ts — Theme D student data layer
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass, seedAssignment, seedEnrollment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import {
  getStudentOverview,
  getStudentTodo,
  getStudentDone,
  getStudentGrades,
  getStudentClassDetail,
} from '@/app/actions/getStudentData'

const PW = 'Stud_pw_123!'
const tag = `sd-${Date.now()}`

let instructorId: string
let studentId: string
let classId: string
let quizAsgId: string
let hwAsgId: string
let manualAsgId: string
let quizAssessmentId: string

beforeAll(async () => {
  const admin = createAdminClient()

  const instr = await createUser({ role: 'instructor', email: `${tag}-instr@x.com`, password: PW, fullName: 'SD Instr' })
  instructorId = instr.id
  const stu = await createUser({ role: 'student', email: `${tag}-stu@x.com`, password: PW, fullName: 'SD Student', studentNumber: 'SD-1' })
  studentId = stu.id

  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'SD Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: 'Midyear' })
  classId = cls.id
  await seedEnrollment({ studentId, classId })

  // Quiz (30 pts) — graded submission 24/30 = 80%
  const { data: quiz } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'SD Quiz', type: 'quiz', total_points: 30, questions: [] }).select('id').single()
  quizAssessmentId = quiz!.id
  const qa = await seedAssignment({ assessmentId: quiz!.id, classId, instructorId })
  quizAsgId = qa.id
  await admin.from('submissions').insert({ assignment_id: quizAsgId, student_id: studentId, instructor_id: instructorId, answers: {}, earned: 24, possible: 30, score: 80, status: 'graded', graded_at: new Date().toISOString() })

  // Homework (10 pts) — no submission → a to-do
  const { data: hw } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'SD Homework', type: 'activity', total_points: 10, questions: [] }).select('id').single()
  const ha = await seedAssignment({ assessmentId: hw!.id, classId, instructorId })
  hwAsgId = ha.id

  // A MANUAL assessment with a (contrived) submission — must NEVER appear in the Done list.
  const { data: man } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'SD Manual', type: 'activity', total_points: 20, questions: [], is_manual: true }).select('id').single()
  manualAsgId = (await seedAssignment({ assessmentId: man!.id, classId, instructorId })).id
  await admin.from('submissions').insert({ assignment_id: manualAsgId, student_id: studentId, instructor_id: instructorId, answers: {}, earned: 18, possible: 20, score: 90, status: 'graded', graded_at: new Date().toISOString() })
})

describe('getStudentOverview', () => {
  it('returns the student\'s class with both tasks + submission status', async () => {
    await setTestUser(`${tag}-stu@x.com`, PW)
    const ov = await getStudentOverview()
    expect(ov.classes).toHaveLength(1)
    const cls = ov.classes[0]
    expect(cls.tasks).toHaveLength(3) // quiz + homework + manual

    const quiz = cls.tasks.find((t) => t.assignmentId === quizAsgId)!
    expect(quiz.submitted).toBe(true)
    expect(quiz.graded).toBe(true)
    expect(quiz.scorePct).toBe(80)

    const hw = cls.tasks.find((t) => t.assignmentId === hwAsgId)!
    expect(hw.submitted).toBe(false)
    expect(hw.scorePct).toBeNull()
  })
})

describe('getStudentClassDetail', () => {
  it('returns the one class for an enrolled student', async () => {
    await setTestUser(`${tag}-stu@x.com`, PW)
    const detail = await getStudentClassDetail({ classId })
    expect(detail).not.toBeNull()
    expect(detail!.tasks).toHaveLength(3) // quiz + homework + manual
  })
})

describe('getStudentTodo', () => {
  it('lists the un-submitted online homework, not the completed quiz', async () => {
    await setTestUser(`${tag}-stu@x.com`, PW)
    const todo = await getStudentTodo()
    const ids = todo.map((t) => t.assignmentId)
    expect(ids).toContain(hwAsgId)
    expect(ids).not.toContain(quizAsgId) // already submitted
    expect(todo[0].classLabel).toMatch(new RegExp(tag))
  })
})

describe('getStudentDone', () => {
  it('lists the submitted quiz (with a submit timestamp), not the un-submitted homework', async () => {
    await setTestUser(`${tag}-stu@x.com`, PW)
    const done = await getStudentDone()
    const ids = done.map((t) => t.assignmentId)
    expect(ids).toContain(quizAsgId)
    expect(ids).not.toContain(hwAsgId)
    const quiz = done.find((t) => t.assignmentId === quizAsgId)!
    expect(quiz.submittedAt).not.toBeNull()
    expect(quiz.classLabel).toMatch(new RegExp(tag))
  })

  it('excludes manual/offline items even if they have a submission row', async () => {
    await setTestUser(`${tag}-stu@x.com`, PW)
    const done = await getStudentDone()
    expect(done.map((t) => t.assignmentId)).not.toContain(manualAsgId)
  })
})

describe('getStudentGrades', () => {
  it('returns a read-only breakdown with the quiz cell at 80% + a midterm mark', async () => {
    await setTestUser(`${tag}-stu@x.com`, PW)
    const grades = await getStudentGrades()
    expect(grades.classes).toHaveLength(1)
    const g = grades.classes[0]
    expect(g.cells[quizAssessmentId]).toBe(80)
    expect(g.midtermMark).not.toBeNull()
  })
})
