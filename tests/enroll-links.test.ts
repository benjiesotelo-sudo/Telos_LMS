import { describe, it, expect } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { generateEnrollLink } from '@/app/actions/generateEnrollLink'
import { listEnrollLinks } from '@/app/actions/listEnrollLinks'
import { revokeEnrollLink } from '@/app/actions/revokeEnrollLink'

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

describe('listEnrollLinks + revokeEnrollLink', () => {
  it('lists active links for the caller and excludes revoked ones', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-mgr@x.com`, password: PW, fullName: 'M' })
    const courseId = (await seedCourse({ instructorId: instr.id, code: `${tag}-MG`, title: 'C' })).id
    const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
    await setTestUser(instr.email, PW)
    const a = await generateEnrollLink({ kind: 'class', classId })
    const b = await generateEnrollLink({ kind: 'general' })
    let rows = await listEnrollLinks()
    expect(rows.length).toBe(2)
    const classRow = rows.find((r) => r.kind === 'class')
    expect(classRow?.className).toBeTruthy()
    // revoke one
    await revokeEnrollLink({ id: rows[0].id })
    rows = await listEnrollLinks()
    expect(rows.length).toBe(1)
  })

  it('excludes expired-but-unrevoked links', async () => {
    const instr = await createUser({ role: 'instructor', email: `${tag}-exp@x.com`, password: PW, fullName: 'E' })
    const courseId = (await seedCourse({ instructorId: instr.id, code: `${tag}-EX`, title: 'C' })).id
    const classId = (await seedClass({ instructorId: instr.id, courseId, period: 'Midyear' })).id
    await setTestUser(instr.email, PW)
    const expired = await generateEnrollLink({ kind: 'class', classId })
    const live = await generateEnrollLink({ kind: 'general' })
    // force the first link into the past (unrevoked)
    const admin = createAdminClient()
    const past = new Date(Date.now() - 86400000).toISOString()
    await admin.from('enroll_links').update({ expires_at: past }).eq('token', expired.token)
    const rows = await listEnrollLinks()
    const tokens = rows.map((r) => r.token)
    expect(tokens).not.toContain(expired.token)
    expect(tokens).toContain(live.token)
  })

  it('forbids revoking another instructor\'s link', async () => {
    const owner = await createUser({ role: 'instructor', email: `${tag}-own2@x.com`, password: PW, fullName: 'O' })
    await setTestUser(owner.email, PW)
    await generateEnrollLink({ kind: 'general' })
    const rows = await listEnrollLinks()
    const other = await createUser({ role: 'instructor', email: `${tag}-oth2@x.com`, password: PW, fullName: 'T' })
    await setTestUser(other.email, PW)
    await expect(revokeEnrollLink({ id: rows[0].id })).rejects.toThrow()
  })
})
