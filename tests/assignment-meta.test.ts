import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUser, seedCourse, seedClass, seedAssignment, seedEnrollment } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { importAssessment } from '@/app/actions/importAssessment'
import { createAssignment } from '@/app/actions/createAssignment'
import { setAssignmentMeta } from '@/app/actions/setAssignmentMeta'
import { getTakePayload } from '@/app/actions/getTakePayload'
import type { AssessmentImport } from '@/lib/types'

const quiz1: AssessmentImport = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/quiz-1.json', import.meta.url)), 'utf-8'),
)

const PASSWORD = 'Passw0rd!meta'
const INSTR_EMAIL = 'am-instr@telos.test'
const INSTR2_EMAIL = 'am-instr2@telos.test'

let instructorId: string
let instructor2Id: string
let assessmentId: string
let classId: string

beforeAll(async () => {
  const instr = await createUser({
    role: 'instructor',
    email: INSTR_EMAIL,
    password: PASSWORD,
    fullName: 'AM Instructor',
  })
  instructorId = instr.id

  const instr2 = await createUser({
    role: 'instructor',
    email: INSTR2_EMAIL,
    password: PASSWORD,
    fullName: 'AM Instructor 2',
  })
  instructor2Id = instr2.id

  await setTestUser(INSTR_EMAIL, PASSWORD)
  const imported = await importAssessment(quiz1)
  assessmentId = imported.assessmentId

  const course = await seedCourse({ instructorId, code: 'AM101', title: 'AM Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: '1st Semester' })
  classId = cls.id
})

// ─── createAssignment ────────────────────────────────────────────────────────

describe('createAssignment — period / active / revealAnswers', () => {
  it('stores explicit period=final, active=false, revealAnswers=true', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const { assignmentId } = await createAssignment({
      assessmentId,
      classId,
      period: 'final',
      active: false,
      revealAnswers: true,
    })

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data } = await admin
      .from('assignments')
      .select('period, active, reveal_answers')
      .eq('id', assignmentId)
      .single()

    expect(data!.period).toBe('final')
    expect(data!.active).toBe(false)
    expect(data!.reveal_answers).toBe(true)
  })

  it('defaults to period=midterm, active=true, revealAnswers=false', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const { assignmentId } = await createAssignment({
      assessmentId,
      classId,
      period: 'midterm',
    })

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data } = await admin
      .from('assignments')
      .select('period, active, reveal_answers')
      .eq('id', assignmentId)
      .single()

    expect(data!.period).toBe('midterm')
    expect(data!.active).toBe(true)
    expect(data!.reveal_answers).toBe(false)
  })
})

// ─── setAssignmentMeta ───────────────────────────────────────────────────────

describe('setAssignmentMeta', () => {
  it('owner can toggle active, revealAnswers, and period', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const { assignmentId } = await createAssignment({
      assessmentId,
      classId,
      period: 'midterm',
    })

    const result = await setAssignmentMeta({
      assignmentId,
      active: false,
      revealAnswers: true,
      period: 'final',
    })
    expect(result.ok).toBe(true)

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data } = await admin
      .from('assignments')
      .select('period, active, reveal_answers')
      .eq('id', assignmentId)
      .single()

    expect(data!.period).toBe('final')
    expect(data!.active).toBe(false)
    expect(data!.reveal_answers).toBe(true)
  })

  it('owner can update deadline fields', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const { assignmentId } = await createAssignment({
      assessmentId,
      classId,
      period: 'midterm',
    })

    const opensAt = new Date(Date.now() - 60_000).toISOString()
    const closesAt = new Date(Date.now() + 3_600_000).toISOString()
    await setAssignmentMeta({ assignmentId, opensAt, closesAt })

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data } = await admin
      .from('assignments')
      .select('opens_at, closes_at')
      .eq('id', assignmentId)
      .single()

    expect(new Date(data!.opens_at).getTime()).toBeCloseTo(new Date(opensAt).getTime(), -3)
    expect(new Date(data!.closes_at).getTime()).toBeCloseTo(new Date(closesAt).getTime(), -3)
  })

  it('clearing a deadline with null writes NULL; omitting (undefined) leaves it unchanged', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const { assignmentId } = await createAssignment({
      assessmentId,
      classId,
      period: 'midterm',
    })

    const admin = (await import('@/lib/supabase/server')).createAdminClient()

    // 1) Set both deadlines.
    const opensAt = new Date(Date.now() - 60_000).toISOString()
    const closesAt = new Date(Date.now() + 3_600_000).toISOString()
    await setAssignmentMeta({ assignmentId, opensAt, closesAt })

    const { data: afterSet } = await admin
      .from('assignments')
      .select('opens_at, closes_at')
      .eq('id', assignmentId)
      .single()
    expect(afterSet!.opens_at).not.toBeNull()
    expect(afterSet!.closes_at).not.toBeNull()

    // 2) Clear opensAt (null) while OMITTING closesAt (undefined).
    await setAssignmentMeta({ assignmentId, opensAt: null })

    const { data: afterClear } = await admin
      .from('assignments')
      .select('opens_at, closes_at')
      .eq('id', assignmentId)
      .single()

    // opensAt explicitly cleared → NULL
    expect(afterClear!.opens_at).toBeNull()
    // closesAt was omitted (undefined) → unchanged
    expect(afterClear!.closes_at).not.toBeNull()
    expect(new Date(afterClear!.closes_at).getTime()).toBeCloseTo(new Date(closesAt).getTime(), -3)
  })

  it('a different instructor is rejected', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const { assignmentId } = await createAssignment({
      assessmentId,
      classId,
      period: 'midterm',
    })

    // Switch to a different instructor who does NOT own this class
    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(
      setAssignmentMeta({ assignmentId, active: false }),
    ).rejects.toThrow()
  })
})

// ─── getTakePayload — inactive gate ──────────────────────────────────────────

describe('getTakePayload — inactive assignment is blocked', () => {
  it('throws /not.*available/i when assignment.active = false', async () => {
    const stu = await createUser({
      role: 'student',
      email: 'am-take-blocked@telos.test',
      password: PASSWORD,
      fullName: 'AM Student Blocked',
    })
    await seedEnrollment({ studentId: stu.id, classId })

    // Insert inactive assignment directly via admin (bypasses action guards)
    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data: row, error } = await admin
      .from('assignments')
      .insert({
        assessment_id: assessmentId,
        class_id: classId,
        instructor_id: instructorId,
        active: false,
      })
      .select('id')
      .single()
    if (error) throw error

    await setTestUser('am-take-blocked@telos.test', PASSWORD)
    await expect(getTakePayload(row!.id)).rejects.toThrow(/not.*available/i)
  })

  it('succeeds when assignment is active=true (default)', async () => {
    const stu = await createUser({
      role: 'student',
      email: 'am-take-active@telos.test',
      password: PASSWORD,
      fullName: 'AM Student Active',
    })
    await seedEnrollment({ studentId: stu.id, classId })

    // seedAssignment uses DB default active=true
    const { id: assignmentId } = await seedAssignment({ assessmentId, classId, instructorId })

    await setTestUser('am-take-active@telos.test', PASSWORD)
    const payload = await getTakePayload(assignmentId)
    expect(payload.title).toBe(quiz1.title)
  })

  it('owner can set + clear a per-assignment time limit (duration_minutes)', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const { id: assignmentId } = await seedAssignment({ assessmentId, classId, instructorId })
    const admin = (await import('@/lib/supabase/server')).createAdminClient()

    await setAssignmentMeta({ assignmentId, durationMinutes: 25 })
    let { data } = await admin.from('assignments').select('duration_minutes').eq('id', assignmentId).single()
    expect(data!.duration_minutes).toBe(25)

    await setAssignmentMeta({ assignmentId, durationMinutes: null })
    ;({ data } = await admin.from('assignments').select('duration_minutes').eq('id', assignmentId).single())
    expect(data!.duration_minutes).toBeNull()
  })
})
