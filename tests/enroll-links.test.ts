import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'

const PW = 'Test_pw_123!'
const tag = `lnk-${Date.now()}`

describe('generateEnrollLink', () => {
  it('class link defaults to 7-day expiry and embeds the token', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-i@x.com`, password: PW, fullName: 'I' })
    const courseId = (await seedCourse({ instructorId: instr.id, code: `${tag}-C`, title: 'C' })).id
    const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
    await setTestUser(instr.email, PW)
    const res = await generateEnrollLink({ kind: 'class', classId })
    expect(res.url).toContain(res.token)
    const days = (new Date(res.expiresAt).getTime() - Date.now()) / 86400000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
  })

  it('general link defaults to 2-day expiry and has null class_id', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-g@x.com`, password: PW, fullName: 'G' })
    await setTestUser(instr.email, PW)
    const res = await generateEnrollLink({ kind: 'general' })
    const admin = createAdminClient()
    const { data } = await admin.from('enroll_links').select('class_id, kind').eq('token', res.token).single()
    expect(data?.kind).toBe('general')
    expect(data?.class_id).toBeNull()
    const days = (new Date(res.expiresAt).getTime() - Date.now()) / 86400000
    expect(days).toBeGreaterThan(1.9)
    expect(days).toBeLessThan(2.1)
  })
})
