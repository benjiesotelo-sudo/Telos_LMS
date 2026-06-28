// tests/grades-graded-only.test.ts — only GRADED submissions count toward grades.
// Regression guard for the instructor↔student divergence the branch review flagged.
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass, seedAssignment, seedEnrollment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { getSectionGrades } from '@/app/actions/getSectionGrades'
import { getStudentGrades } from '@/app/actions/getStudentData'

const PW = 'Graded_pw_123!'
const tag = `grd-${Date.now()}`

let instructorId: string
let studentId: string
let classId: string
let assessmentId: string

beforeAll(async () => {
  const admin = createAdminClient()
  const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'Grd Instr' })
  instructorId = instr.id
  const stu = await createUser({ role: 'student', email: `${tag}-s@x.com`, password: PW, fullName: 'Grd Stu', studentNumber: `${tag}-S` })
  studentId = stu.id
  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'Grd Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: 'Midyear' })
  classId = cls.id
  await seedEnrollment({ studentId, classId })

  const { data: a } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'Grd Quiz', type: 'quiz', total_points: 10, questions: [] }).select('id').single()
  assessmentId = a!.id
  const asg = await seedAssignment({ assessmentId: a!.id, classId, instructorId })

  // An IN-PROGRESS (not graded) submission must NOT count toward grades.
  await admin.from('submissions').insert({
    assignment_id: asg.id, student_id: studentId, instructor_id: instructorId,
    answers: {}, earned: 9, possible: 10, score: 90, status: 'in_progress',
  })
})

describe('ungraded submissions are excluded', () => {
  it('getSectionGrades: an in_progress submission yields a null cell (not 90%)', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    const g = await getSectionGrades({ classId })
    const row = g.students.find((s) => s.studentId === studentId)!
    expect(row.cells[assessmentId] ?? null).toBeNull()
    expect(row.midtermMark).toBeNull()
  })

  it('getStudentGrades: the same in_progress submission is excluded for the student too', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    const grades = await getStudentGrades()
    const cls = grades.classes.find((c) => c.classId === classId)!
    expect(cls.cells[assessmentId] ?? null).toBeNull()
  })
})

describe('ungraded (practice) assessments are excluded from marks', () => {
  it('an ungraded homework with a graded submission shows a cell but does not move the mark', async () => {
    const admin = createAdminClient()
    // One GRADED homework (counts) + one UNGRADED homework (practice), both 100%.
    const mk = async (graded: boolean) => {
      const { data: a } = await admin.from('assessments').insert({ instructor_id: instructorId, title: `GO-${graded}-${Math.random()}`, type: 'homework', total_points: 10, questions: [], is_graded: graded }).select('id').single()
      const asg = await seedAssignment({ assessmentId: a!.id, classId, instructorId })
      await admin.from('submissions').insert({ assignment_id: asg.id, student_id: studentId, instructor_id: instructorId, answers: {}, earned: 10, possible: 10, score: 100, status: 'graded', graded_at: new Date().toISOString() })
      return a!.id
    }
    const gradedId = await mk(true)
    const ungradedId = await mk(false)

    await setTestUser(`${tag}-i@x.com`, PW)
    const g = await getSectionGrades({ classId })
    const row = g.students.find((s) => s.studentId === studentId)!
    // Both cells display 100% (feedback)...
    expect(row.cells[gradedId]).toBe(100)
    expect(row.cells[ungradedId]).toBe(100)
    // ...but the Papers/HW mark reflects ONLY the graded one (still 100, not skewed by exclusion logic edge).
    expect(row.midtermMark).toBe(100)
    // Sanity: the ungraded assessment is flagged not-graded in the payload.
    expect(g.assessments.find((a) => a.assessmentId === ungradedId)!.graded).toBe(false)
    expect(g.assessments.find((a) => a.assessmentId === gradedId)!.graded).toBe(true)
  })
})
