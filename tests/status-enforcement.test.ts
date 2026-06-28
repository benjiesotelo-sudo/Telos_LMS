// tests/status-enforcement.test.ts — suspended/pending students can't take or submit
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass, seedAssignment, seedEnrollment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { getTakePayload } from '@/app/actions/getTakePayload'
import { submitAssessment } from '@/app/actions/submitAssessment'

const PW = 'Stat_pw_123!'
const tag = `stat-${Date.now()}`

let instructorId: string
let classId: string
let activeAsgId: string
let suspAsgId: string

async function seedTakeable() {
  const admin = createAdminClient()
  const { data: a } = await admin.from('assessments').insert({ instructor_id: instructorId, title: `Stat Quiz ${Math.random()}`, type: 'quiz', total_points: 1, questions: [{ id: 'q1', kind: 'num', prompt: '1+1?', points: 1, is_bonus: false }] }).select('id').single()
  await admin.from('assessment_keys').insert({ assessment_id: a!.id, answer_key: { q1: { value: '2', points: 1, is_bonus: false } } })
  const asg = await seedAssignment({ assessmentId: a!.id, classId, instructorId })
  return asg.id
}

beforeAll(async () => {
  const admin = createAdminClient()
  const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'Stat Instr' })
  instructorId = instr.id
  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'Stat Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: 'Midyear' })
  classId = cls.id

  const active = await createUser({ role: 'student', email: `${tag}-active@x.com`, password: PW, fullName: 'Active Stu', studentNumber: `${tag}-A` })
  await seedEnrollment({ studentId: active.id, classId })

  const susp = await createUser({ role: 'student', email: `${tag}-susp@x.com`, password: PW, fullName: 'Susp Stu', studentNumber: `${tag}-S` })
  await seedEnrollment({ studentId: susp.id, classId })
  await admin.from('profiles').update({ status: 'suspended' }).eq('id', susp.id)

  activeAsgId = await seedTakeable()
  suspAsgId = await seedTakeable()
})

describe('active student', () => {
  it('can load + submit a takeable assessment', async () => {
    await setTestUser(`${tag}-active@x.com`, PW)
    const payload = await getTakePayload(activeAsgId)
    expect(payload.questions).toHaveLength(1)
    const res = await submitAssessment({ assignmentId: activeAsgId, answers: { q1: '2' } })
    expect(res.earned).toBe(1)
  })
})

describe('suspended student', () => {
  it('cannot load the take payload', async () => {
    await setTestUser(`${tag}-susp@x.com`, PW)
    await expect(getTakePayload(suspAsgId)).rejects.toThrow(/not active/i)
  })
  it('cannot submit', async () => {
    await setTestUser(`${tag}-susp@x.com`, PW)
    await expect(submitAssessment({ assignmentId: suspAsgId, answers: { q1: '2' } })).rejects.toThrow(/not active/i)
  })
})
