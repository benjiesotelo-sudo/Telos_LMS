import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'
import { createCourse } from '@/app/actions/createCourse'

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
