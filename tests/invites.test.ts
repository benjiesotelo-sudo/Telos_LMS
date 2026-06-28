// tests/invites.test.ts — Theme D in-app class invitations
import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { searchStudents, inviteToClass, getMyInvites, acceptInvite, declineInvite } from '@/app/actions/invites'

const PW = 'Inv_pw_123!'
const tag = `inv-${Date.now()}`

let instructorId: string
let classId: string
let studentA: string
let studentB: string

beforeAll(async () => {
  const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'Inv Instr' })
  instructorId = instr.id
  const a = await createUser({ role: 'student', email: `${tag}-a@x.com`, password: PW, fullName: 'Alice Invitee', studentNumber: `${tag}-A` })
  studentA = a.id
  const b = await createUser({ role: 'student', email: `${tag}-b@x.com`, password: PW, fullName: 'Bob Invitee', studentNumber: `${tag}-B` })
  studentB = b.id

  const course = await seedCourse({ instructorId, code: `${tag}`, title: 'Inv Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: 'Midyear' })
  classId = cls.id
})

describe('searchStudents', () => {
  it('finds a student by student number (instructor)', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    const res = await searchStudents({ query: `${tag}-A` })
    expect(res.some((u) => u.id === studentA)).toBe(true)
  })
  it('a student caller is forbidden', async () => {
    await setTestUser(`${tag}-a@x.com`, PW)
    await expect(searchStudents({ query: tag })).rejects.toThrow(/forbidden/i)
  })
})

describe('invite → accept', () => {
  it('owner invites; student sees it; accepts → active enrollment', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await inviteToClass({ classId, studentId: studentA })

    await setTestUser(`${tag}-a@x.com`, PW)
    const invites = await getMyInvites()
    expect(invites.map((i) => i.classId)).toContain(classId)
    expect(invites[0].invitedByName).toBe('Inv Instr')

    await acceptInvite({ classId })
    const admin = createAdminClient()
    const { data } = await admin.from('enrollments').select('status').eq('class_id', classId).eq('student_id', studentA).single()
    expect(data!.status).toBe('active')
  })

  it('re-inviting an enrolled student is rejected', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await expect(inviteToClass({ classId, studentId: studentA })).rejects.toThrow(/already/i)
  })
})

describe('invite → decline', () => {
  it('decline removes the invited enrollment row', async () => {
    await setTestUser(`${tag}-i@x.com`, PW)
    await inviteToClass({ classId, studentId: studentB })

    await setTestUser(`${tag}-b@x.com`, PW)
    await declineInvite({ classId })
    const admin = createAdminClient()
    const { data } = await admin.from('enrollments').select('id').eq('class_id', classId).eq('student_id', studentB)
    expect(data).toHaveLength(0)
  })
})

describe('authorization', () => {
  it('a non-owner instructor cannot invite into the class', async () => {
    const other = await createUser({ role: 'instructor', email: `${tag}-i2@x.com`, password: PW, fullName: 'Other Instr' })
    void other
    await setTestUser(`${tag}-i2@x.com`, PW)
    await expect(inviteToClass({ classId, studentId: studentB })).rejects.toThrow(/owner/i)
  })

  it('cannot invite a non-student (e.g. an instructor) even by direct call', async () => {
    const victim = await createUser({ role: 'instructor', email: `${tag}-victim@x.com`, password: PW, fullName: 'Victim Instr' })
    await setTestUser(`${tag}-i@x.com`, PW)
    await expect(inviteToClass({ classId, studentId: victim.id })).rejects.toThrow(/only students/i)
  })
})
