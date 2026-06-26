import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'
import { createCourse } from '@/app/actions/createCourse'
import { createClass } from '@/app/actions/createClass'
import { listClasses, listPics } from '@/app/actions/listClasses'

const PW = 'Test_pw_123!'
const tag = `cls-${Date.now()}`

describe('createCourse', () => {
  it('creates a course owned by the caller with a description', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'I' })
    await setTestUser(instr.email, PW)
    const { courseId } = await createCourse({ code: `${tag}-AMS`, title: 'Algebra', description: 'Intro' })
    const admin = createAdminClient()
    const { data } = await admin.from('courses').select('instructor_id, description').eq('id', courseId).single()
    expect(data?.instructor_id).toBe(instr.id)
    expect(data?.description).toBe('Intro')
  })
})

describe('createClass + listClasses', () => {
  it('creates a section and lists it with a display name', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-i2@x.com`, password: PW, fullName: 'I2' })
    await setTestUser(instr.email, PW)
    const { courseId } = await createCourse({ code: `${tag}-MATH`, title: 'Math', description: '' })
    const { classId } = await createClass({ courseId, period: 'Midyear', sectionLabel: '6A', pic: 'Prof X' })
    expect(classId).toBeTruthy()
    const rows = await listClasses()
    const row = rows.find((r) => r.id === classId)
    expect(row?.displayName).toBe(`${tag}-MATH - 6A`)
    expect(row?.pic).toBe('Prof X')
    const pics = await listPics()
    expect(pics).toContain('Prof X')
  })

  it('rejects a class for a course the caller does not own', async () => {
    const owner = await createUser({ role: 'instructor', email: `${tag}-own@x.com`, password: PW, fullName: 'O' })
    await setTestUser(owner.email, PW)
    const { courseId } = await createCourse({ code: `${tag}-OWN`, title: 'Owned', description: '' })
    const other = await createUser({ role: 'instructor', email: `${tag}-oth@x.com`, password: PW, fullName: 'Oth' })
    await setTestUser(other.email, PW)
    await expect(createClass({ courseId, period: 'Midyear', sectionLabel: '1', pic: '' })).rejects.toThrow()
  })
})
