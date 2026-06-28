// tests/draft-answers.test.ts — server-side draft answers (cross-device resume)
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass, seedAssignment, seedEnrollment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { saveDraft, getDraft } from '@/app/actions/draftAnswers'

const PW = 'Draft_pw_123!'
const tag = `draft-${Date.now()}`

let instructorId: string
let classId: string
let assignmentId: string

beforeAll(async () => {
  const admin = createAdminClient()
  const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'Draft Instr' })
  instructorId = instr.id
  await createUser({ role: 'student', email: `${tag}-s@x.com`, password: PW, fullName: 'Draft Stu', studentNumber: `${tag}-S` })
  await createUser({ role: 'student', email: `${tag}-out@x.com`, password: PW, fullName: 'Outsider', studentNumber: `${tag}-O` })

  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'Draft Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: 'Midyear' })
  classId = cls.id
  const sId = (await admin.from('profiles').select('id').eq('email', `${tag}-s@x.com`).single()).data!.id
  await seedEnrollment({ studentId: sId, classId })

  const { data: a } = await admin.from('assessments').insert({ instructor_id: instructorId, title: 'Draft Quiz', type: 'quiz', total_points: 2, questions: [] }).select('id').single()
  assignmentId = (await seedAssignment({ assessmentId: a!.id, classId, instructorId })).id
})

describe('saveDraft / getDraft', () => {
  it('round-trips a student\'s in-progress answers', async () => {
    await setTestUser(`${tag}-s@x.com`, PW)
    expect(await getDraft({ assignmentId })).toEqual({})
    await saveDraft({ assignmentId, answers: { q1: '5', q2: 'blue' } })
    expect(await getDraft({ assignmentId })).toEqual({ q1: '5', q2: 'blue' })
    // a later save overwrites
    await saveDraft({ assignmentId, answers: { q1: '7' } })
    expect(await getDraft({ assignmentId })).toEqual({ q1: '7' })
  })

  it('a non-enrolled student cannot save a draft', async () => {
    await setTestUser(`${tag}-out@x.com`, PW)
    await expect(saveDraft({ assignmentId, answers: { q1: 'x' } })).rejects.toThrow(/not enrolled/i)
  })
})
