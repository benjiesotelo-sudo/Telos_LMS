import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { signInAs } from '@/tests/helpers/auth'
import {
  createUser,
  seedCourse,
  seedClass,
  seedAssignment,
  seedEnrollment,
} from '@/tests/helpers/fixtures'

const PW = 'Test_pw_123!'
const tag = `rls-${Date.now()}`

// instructor A world
let instrA: { id: string; email: string; password: string }
let courseA: string
let classA: string
let assessmentA: string
let assignmentA: string
let submissionStudentX: string

// instructor B world
let instrB: { id: string; email: string; password: string }
let courseB: string

// students
let studentX: { id: string; email: string; password: string } // enrolled in class A
let studentY: { id: string; email: string; password: string } // enrolled in class B

beforeAll(async () => {
  const admin = createAdminClient()

  instrA = await createUser({
    role: 'instructor',
    email: `${tag}-instrA@example.com`,
    password: PW,
    fullName: 'Instructor A',
  })
  instrB = await createUser({
    role: 'instructor',
    email: `${tag}-instrB@example.com`,
    password: PW,
    fullName: 'Instructor B',
  })
  studentX = await createUser({
    role: 'student',
    email: `${tag}-studentX@example.com`,
    password: PW,
    fullName: 'Student X',
    studentNumber: 'SX-001',
  })
  studentY = await createUser({
    role: 'student',
    email: `${tag}-studentY@example.com`,
    password: PW,
    fullName: 'Student Y',
    studentNumber: 'SY-001',
  })

  // Course A owned by instructor A; course B owned by instructor B.
  courseA = (await seedCourse({ instructorId: instrA.id, code: `${tag}-A`, title: 'Course A' })).id
  courseB = (await seedCourse({ instructorId: instrB.id, code: `${tag}-B`, title: 'Course B' })).id
  classA = (await seedClass({ instructorId: instrA.id, courseId: courseA, period: '1st Semester' })).id
  const classB = (await seedClass({ instructorId: instrB.id, courseId: courseB, period: '1st Semester' })).id

  // Student X enrolled in A; student Y enrolled in B.
  await seedEnrollment({ studentId: studentX.id, classId: classA })
  await seedEnrollment({ studentId: studentY.id, classId: classB })

  // Assessment + key owned by instructor A, assigned into class A.
  const { data: aRow, error: aErr } = await admin
    .from('assessments')
    .insert({
      instructor_id: instrA.id,
      title: 'Quiz A',
      type: 'quiz',
      total_points: 1,
      questions: [{ id: 'q1', kind: 'num', prompt: '1+1?', points: 1, is_bonus: false }],
    })
    .select('id')
    .single()
  if (aErr) throw aErr
  assessmentA = aRow.id
  const { error: kErr } = await admin
    .from('assessment_keys')
    .insert({ assessment_id: assessmentA, answer_key: { q1: { value: '2', points: 1, is_bonus: false } } })
  if (kErr) throw kErr
  assignmentA = (
    await seedAssignment({
      assessmentId: assessmentA,
      classId: classA,
      instructorId: instrA.id,
    })
  ).id

  // A graded submission by student X in class A (written via admin, as submitAssessment would).
  const { data: sRow, error: sErr } = await admin
    .from('submissions')
    .insert({
      assignment_id: assignmentA,
      student_id: studentX.id,
      instructor_id: instrA.id,
      answers: { q1: '2' },
      earned: 1,
      possible: 1,
      score: 100,
      status: 'graded',
    })
    .select('id')
    .single()
  if (sErr) throw sErr
  submissionStudentX = sRow.id
})

describe('cross-instructor isolation', () => {
  it('instructor A cannot read instructor B course', async () => {
    const { client } = await signInAs(instrA.email, PW)
    const { data } = await client.from('courses').select('id').eq('id', courseB)
    expect(data).toEqual([])
  })

  it('instructor B cannot read instructor A assessment (B has none, A sees only own)', async () => {
    const { client } = await signInAs(instrB.email, PW)
    const { data } = await client.from('assessments').select('id').eq('id', assessmentA)
    expect(data).toEqual([])
  })

  it('instructor A can read own course', async () => {
    const { client } = await signInAs(instrA.email, PW)
    const { data } = await client.from('courses').select('id').eq('id', courseA)
    expect(data).toEqual([{ id: courseA }])
  })

  it('instructor A can read submissions for own course; instructor B cannot', async () => {
    const a = await signInAs(instrA.email, PW)
    const { data: aData } = await a.client.from('submissions').select('id').eq('id', submissionStudentX)
    expect(aData).toEqual([{ id: submissionStudentX }])

    const b = await signInAs(instrB.email, PW)
    const { data: bData } = await b.client.from('submissions').select('id').eq('id', submissionStudentX)
    expect(bData).toEqual([])
  })
})

describe('cross-student isolation', () => {
  it('student Y cannot read student X submission', async () => {
    const { client } = await signInAs(studentY.email, PW)
    const { data } = await client.from('submissions').select('id').eq('id', submissionStudentX)
    expect(data).toEqual([])
  })

  it('student X can read own submission', async () => {
    const { client } = await signInAs(studentX.email, PW)
    const { data } = await client.from('submissions').select('id').eq('id', submissionStudentX)
    expect(data).toEqual([{ id: submissionStudentX }])
  })
})

describe('answer-key secrecy (service-role only)', () => {
  it('a student client gets 0 rows from assessment_keys', async () => {
    const { client } = await signInAs(studentX.email, PW)
    const { data } = await client.from('assessment_keys').select('assessment_id').eq('assessment_id', assessmentA)
    expect(data).toEqual([])
  })

  it('an instructor client (even the owner) gets 0 rows from assessment_keys', async () => {
    const { client } = await signInAs(instrA.email, PW)
    const { data } = await client.from('assessment_keys').select('assessment_id').eq('assessment_id', assessmentA)
    expect(data).toEqual([])
  })

  it('a student client gets 0 rows from enroll_links', async () => {
    const { client } = await signInAs(studentX.email, PW)
    const { data } = await client.from('enroll_links').select('token')
    expect(data).toEqual([])
  })
})

describe('privilege escalation is blocked', () => {
  it('a student cannot self-promote to admin via UPDATE profiles', async () => {
    const { client } = await signInAs(studentY.email, PW)
    const { data, error } = await client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', studentY.id)
      .select('id')
    // Column-level revoke on (role, status) makes this a permission error,
    // or — depending on the driver — a no-op affecting 0 rows. Either way the
    // promotion must NOT take effect.
    expect(error !== null || (data ?? []).length === 0).toBe(true)

    // Re-read via service-role to prove the role is still 'student'.
    const admin = createAdminClient()
    const { data: prof, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', studentY.id)
      .single()
    if (profErr) throw profErr
    expect(prof.role).toBe('student')
  })
})

describe('no client-side submission writes', () => {
  it('a student client direct INSERT into submissions is rejected', async () => {
    const { client } = await signInAs(studentY.email, PW)
    const { data, error } = await client
      .from('submissions')
      .insert({
        assignment_id: assignmentA,
        student_id: studentY.id,
        instructor_id: studentY.id,
        answers: { q1: '2' },
        earned: 1,
        possible: 1,
        score: 100,
        status: 'graded',
      })
      .select('id')
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})

describe('enrolled-student READ path', () => {
  it('an enrolled student CAN read their assigned assignment; a non-enrolled student gets 0 rows', async () => {
    const enrolled = await signInAs(studentX.email, PW)
    const { data: inData } = await enrolled.client.from('assignments').select('id').eq('id', assignmentA)
    expect(inData).toEqual([{ id: assignmentA }])

    const notEnrolled = await signInAs(studentY.email, PW)
    const { data: outData } = await notEnrolled.client.from('assignments').select('id').eq('id', assignmentA)
    expect(outData).toEqual([])
  })

  it('an enrolled student CAN read the assessment questions; a non-enrolled student gets 0 rows', async () => {
    const enrolled = await signInAs(studentX.email, PW)
    const { data: inData } = await enrolled.client.from('assessments').select('id').eq('id', assessmentA)
    expect(inData).toEqual([{ id: assessmentA }])

    const notEnrolled = await signInAs(studentY.email, PW)
    const { data: outData } = await notEnrolled.client.from('assessments').select('id').eq('id', assessmentA)
    expect(outData).toEqual([])
  })

  it('assessment_keys returns 0 rows for any student regardless of enrollment', async () => {
    const enrolled = await signInAs(studentX.email, PW)
    const { data: inData } = await enrolled.client
      .from('assessment_keys')
      .select('assessment_id')
      .eq('assessment_id', assessmentA)
    expect(inData).toEqual([])
  })
})
