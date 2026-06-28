// tests/removal-requests.test.ts — instructor removal request → admin approval
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass, seedEnrollment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import {
  requestStudentRemoval,
  listRemovalRequests,
  approveRemoval,
  rejectRemoval,
} from '@/app/actions/removalRequests'

const PW = 'Rem_pw_123!'
const tag = `rem-${Date.now()}`

let instructorId: string
let classId: string
let studentA: string
let studentB: string

async function enrolledCount(studentId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('enrollments').select('id').eq('class_id', classId).eq('student_id', studentId)
  return data?.length ?? 0
}

beforeAll(async () => {
  const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'Rem Instr' })
  instructorId = instr.id
  await createUser({ role: 'admin', email: `${tag}-admin@x.com`, password: PW, fullName: 'Rem Admin' })
  const a = await createUser({ role: 'student', email: `${tag}-a@x.com`, password: PW, fullName: 'Rem Stu A', studentNumber: `${tag}-A` })
  studentA = a.id
  const b = await createUser({ role: 'student', email: `${tag}-b@x.com`, password: PW, fullName: 'Rem Stu B', studentNumber: `${tag}-B` })
  studentB = b.id

  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'Rem Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: 'Midyear' })
  classId = cls.id
  await seedEnrollment({ studentId: studentA, classId })
  await seedEnrollment({ studentId: studentB, classId })
})

describe('requestStudentRemoval', () => {
  it('owner files a pending request; a reason is required; duplicates blocked', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await expect(requestStudentRemoval({ classId, studentId: studentA, reason: '' })).rejects.toThrow(/reason/i)
    await requestStudentRemoval({ classId, studentId: studentA, reason: 'Dropped the course' })
    await expect(requestStudentRemoval({ classId, studentId: studentA, reason: 'again' })).rejects.toThrow(/pending/i)
  })

  it('a non-owner instructor cannot file a request', async () => {
    await createUser({ role: 'instructor', email: `${tag}-i2@x.com`, password: PW, fullName: 'Other' })
    await setTestUser(`${tag}-i2@x.com`, PW)
    await expect(requestStudentRemoval({ classId, studentId: studentB, reason: 'not my class' })).rejects.toThrow(/owner/i)
  })
})

describe('admin review', () => {
  it('a non-admin cannot list requests', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await expect(listRemovalRequests()).rejects.toThrow(/forbidden/i)
  })

  it('admin sees the pending request, approves → enrollment deleted', async () => {
    await setTestUser(`${tag}-admin@x.com`, PW)
    const reqs = await listRemovalRequests()
    const mine = reqs.find((r) => r.classId === classId && r.studentId === studentA)!
    expect(mine).toBeTruthy()
    expect(mine.reason).toMatch(/dropped/i)
    expect(mine.studentName).toBe('Rem Stu A')

    expect(await enrolledCount(studentA)).toBe(1)
    await approveRemoval({ requestId: mine.id })
    expect(await enrolledCount(studentA)).toBe(0)
  })

  it('reject keeps the enrollment', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await requestStudentRemoval({ classId, studentId: studentB, reason: 'mistake?' })

    await setTestUser(`${tag}-admin@x.com`, PW)
    const reqs = await listRemovalRequests()
    const r = reqs.find((x) => x.studentId === studentB)!
    await rejectRemoval({ requestId: r.id })
    expect(await enrolledCount(studentB)).toBe(1)
  })
})
