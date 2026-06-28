import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedClass, seedEnrollment } from '@/tests/helpers/fixtures'
import { listPending } from '@/app/actions/listPending'

const PW = 'Test_pw_123!'
const tag = `pend-${Date.now()}`

describe('listPending', () => {
  it('a pending student enrolled in instructor A class appears in A listPending with className', async () => {
    const instrA = await createUser({ role: 'instructor', email: `${tag}-ia@x.com`, password: PW, fullName: 'InstrA' })
    const courseId = (await seedCourse({ instructorId: instrA.id, code: `${tag}-CA`, title: 'Course A' })).id
    const classId = (await seedClass({ instructorId: instrA.id, courseId, period: 'Midyear', sectionLabel: 'A1' })).id

    // Create student as active, then flip to pending
    const student = await createUser({ role: 'student', email: `${tag}-sa@x.com`, password: PW, fullName: 'StudentA', studentNumber: 'SNA-001' })
    const admin = createAdminClient()
    await admin.from('profiles').update({ status: 'pending' }).eq('id', student.id)

    // Enroll with pending status
    await seedEnrollment({ studentId: student.id, classId })
    await admin.from('enrollments').update({ status: 'pending' }).eq('student_id', student.id).eq('class_id', classId)

    await setTestUser(instrA.email, PW)
    const rows = await listPending()

    const found = rows.find((r) => r.studentId === student.id)
    expect(found).toBeDefined()
    expect(found!.fullName).toBe('StudentA')
    expect(found!.email).toBe(student.email)
    expect(found!.className).toBeTruthy()
    // className should contain the course code and section label
    expect(found!.className).toContain(`${tag}-CA`)
    expect(found!.className).toContain('A1')
  })

  it('a pending student enrolled in instructor A class does NOT appear in instructor B listPending (tenant isolation)', async () => {
    const instrA2 = await createUser({ role: 'instructor', email: `${tag}-ia2@x.com`, password: PW, fullName: 'InstrA2' })
    const instrB = await createUser({ role: 'instructor', email: `${tag}-ib@x.com`, password: PW, fullName: 'InstrB' })
    const courseId = (await seedCourse({ instructorId: instrA2.id, code: `${tag}-CB`, title: 'Course B' })).id
    const classId = (await seedClass({ instructorId: instrA2.id, courseId, period: 'Midyear', sectionLabel: 'B1' })).id

    const student = await createUser({ role: 'student', email: `${tag}-sb@x.com`, password: PW, fullName: 'StudentB', studentNumber: 'SNB-001' })
    const admin = createAdminClient()
    await admin.from('profiles').update({ status: 'pending' }).eq('id', student.id)

    await seedEnrollment({ studentId: student.id, classId })
    await admin.from('enrollments').update({ status: 'pending' }).eq('student_id', student.id).eq('class_id', classId)

    // Instructor B (different instructor) calls listPending
    await setTestUser(instrB.email, PW)
    const rows = await listPending()

    // Student is enrolled in A2's class, not B's — should NOT appear for B
    const found = rows.find((r) => r.studentId === student.id)
    expect(found).toBeUndefined()
  })

  it('an unplaced pending student (no enrollment) appears for any instructor with className null, and an enrolled pending student is NOT counted as unplaced', async () => {
    const instrC = await createUser({ role: 'instructor', email: `${tag}-ic@x.com`, password: PW, fullName: 'InstrC' })
    const courseId = (await seedCourse({ instructorId: instrC.id, code: `${tag}-CC`, title: 'Course C' })).id
    const classId = (await seedClass({ instructorId: instrC.id, courseId, period: 'Midyear', sectionLabel: 'C1' })).id
    const admin = createAdminClient()

    // Unplaced pending student with no enrollment at all — general-link registrant.
    const unplaced = await createUser({ role: 'student', email: `${tag}-sc@x.com`, password: PW, fullName: 'StudentC', studentNumber: 'SNC-001' })
    await admin.from('profiles').update({ status: 'pending' }).eq('id', unplaced.id)

    // A PLACED pending student enrolled in instrC's own class — must NOT be reported as unplaced (className:null).
    const placed = await createUser({ role: 'student', email: `${tag}-scp@x.com`, password: PW, fullName: 'StudentCP', studentNumber: 'SNC-002' })
    await admin.from('profiles').update({ status: 'pending' }).eq('id', placed.id)
    await seedEnrollment({ studentId: placed.id, classId })
    await admin.from('enrollments').update({ status: 'pending' }).eq('student_id', placed.id).eq('class_id', classId)

    await setTestUser(instrC.email, PW)
    const rows = await listPending()

    // Unplaced student appears once, with null className.
    const unplacedRows = rows.filter((r) => r.studentId === unplaced.id)
    expect(unplacedRows).toHaveLength(1)
    expect(unplacedRows[0].className).toBeNull()

    // Placed student appears with a className — never as an unplaced (null) row.
    const placedRows = rows.filter((r) => r.studentId === placed.id)
    expect(placedRows.length).toBeGreaterThan(0)
    expect(placedRows.every((r) => r.className !== null)).toBe(true)
    expect(placedRows.some((r) => r.className === null)).toBe(false)
  })

  it('approving an unplaced registrant WITH a chosen section enrolls + activates them', async () => {
    const { approvePending } = await import('@/app/actions/approvePending')
    const instrD = await createUser({ role: 'instructor', email: `${tag}-id@x.com`, password: PW, fullName: 'InstrD' })
    const courseId = (await seedCourse({ instructorId: instrD.id, code: `${tag}-DD`, title: 'Course D' })).id
    const classId = (await seedClass({ instructorId: instrD.id, courseId, period: 'Midyear', sectionLabel: 'D1' })).id
    const admin = createAdminClient()

    const stu = await createUser({ role: 'student', email: `${tag}-sd@x.com`, password: PW, fullName: 'StudentD', studentNumber: 'SND-001' })
    await admin.from('profiles').update({ status: 'pending' }).eq('id', stu.id) // unplaced: no enrollment

    await setTestUser(instrD.email, PW)
    await approvePending({ studentId: stu.id, classId }) // section-picker passes classId

    const { data: prof } = await admin.from('profiles').select('status').eq('id', stu.id).single()
    expect(prof!.status).toBe('active')
    const { data: enr } = await admin.from('enrollments').select('status').eq('student_id', stu.id).eq('class_id', classId).single()
    expect(enr!.status).toBe('active')
  })
})
