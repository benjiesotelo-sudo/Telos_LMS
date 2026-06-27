// tests/grade-overrides-editor.test.ts
// Covers the per-assessment GradeEditor's data actions:
//   - deleteGradeOverride  (the per-row "↺ revert")
//   - setGradeOverrides    (the batch column Save: upsert + revert-to-auto)
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { importAssessment } from '@/app/actions/importAssessment'
import { setGradeOverride } from '@/app/actions/setGradeOverride'
import { setGradeOverrides } from '@/app/actions/setGradeOverrides'
import { deleteGradeOverride } from '@/app/actions/deleteGradeOverride'
import type { AssessmentImport } from '@/lib/types'

const quiz1: AssessmentImport = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/quiz-1.json', import.meta.url)), 'utf-8'),
)

const PASSWORD = 'Passw0rd!ge'
const INSTR_EMAIL = 'ge-instr@telos.test'
const INSTR2_EMAIL = 'ge-instr2@telos.test'

let instructorId: string
let studentAId: string
let studentBId: string
let assessmentId: string
let assessment2Id: string
let classId: string

async function readOverrideFor(studentId: string, aId: string) {
  const admin = (await import('@/lib/supabase/server')).createAdminClient()
  const { data, error } = await admin
    .from('grade_overrides')
    .select('score')
    .eq('student_id', studentId)
    .eq('assessment_id', aId)
    .eq('class_id', classId)
  if (error) throw error
  return data
}

async function readOverride(studentId: string) {
  return readOverrideFor(studentId, assessmentId)
}

beforeAll(async () => {
  const instr = await createUser({
    role: 'instructor',
    email: INSTR_EMAIL,
    password: PASSWORD,
    fullName: 'GE Instructor',
  })
  instructorId = instr.id

  await createUser({
    role: 'instructor',
    email: INSTR2_EMAIL,
    password: PASSWORD,
    fullName: 'GE Instructor 2',
  })

  const stuA = await createUser({
    role: 'student',
    email: 'ge-studentA@telos.test',
    password: PASSWORD,
    fullName: 'GE Student A',
    studentNumber: 'GE-0001',
  })
  studentAId = stuA.id

  const stuB = await createUser({
    role: 'student',
    email: 'ge-studentB@telos.test',
    password: PASSWORD,
    fullName: 'GE Student B',
    studentNumber: 'GE-0002',
  })
  studentBId = stuB.id

  await setTestUser(INSTR_EMAIL, PASSWORD)
  const imported = await importAssessment(quiz1)
  assessmentId = imported.assessmentId

  const imported2 = await importAssessment({ ...quiz1, title: 'GE Quiz 2' })
  assessment2Id = imported2.assessmentId

  const course = await seedCourse({ instructorId, code: 'GE101', title: 'GE Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: '1st Semester' })
  classId = cls.id
})

describe('deleteGradeOverride', () => {
  it('owner can delete an existing override (revert to auto)', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    await setGradeOverride({ studentId: studentAId, assessmentId, classId, score: 91 })
    expect(await readOverride(studentAId)).toHaveLength(1)

    const res = await deleteGradeOverride({ studentId: studentAId, assessmentId, classId })
    expect(res.ok).toBe(true)
    expect(await readOverride(studentAId)).toHaveLength(0)
  })

  it('deleting a non-existent override is a no-op success', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const res = await deleteGradeOverride({ studentId: studentBId, assessmentId, classId })
    expect(res.ok).toBe(true)
    expect(await readOverride(studentBId)).toHaveLength(0)
  })

  it('a non-owner instructor is rejected', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    await setGradeOverride({ studentId: studentAId, assessmentId, classId, score: 80 })

    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(
      deleteGradeOverride({ studentId: studentAId, assessmentId, classId }),
    ).rejects.toThrow()

    // override survived the rejected delete
    expect(await readOverride(studentAId)).toHaveLength(1)
  })
})

describe('setGradeOverrides (batch save across assessments)', () => {
  it('upserts and reverts across two assessments in one call', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    // Seed an override on assessment2 for B so the null entry deletes something.
    await setGradeOverride({ studentId: studentBId, assessmentId: assessment2Id, classId, score: 60 })

    const res = await setGradeOverrides({
      classId,
      entries: [
        { studentId: studentAId, assessmentId,             score: 77 },   // upsert
        { studentId: studentAId, assessmentId: assessment2Id, score: 42 }, // upsert (other assessment)
        { studentId: studentBId, assessmentId: assessment2Id, score: null }, // delete
      ],
    })
    expect(res.ok).toBe(true)
    expect(res.upserted).toBe(2)
    expect(res.deleted).toBe(1)

    const a1 = await readOverrideFor(studentAId, assessmentId)
    expect(a1).toHaveLength(1)
    expect(Number(a1![0].score)).toBe(77)

    const a2 = await readOverrideFor(studentAId, assessment2Id)
    expect(Number(a2![0].score)).toBe(42)

    expect(await readOverrideFor(studentBId, assessment2Id)).toHaveLength(0)
  })

  it('an empty entries array is a no-op', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    const res = await setGradeOverrides({ classId, entries: [] })
    expect(res).toEqual({ ok: true, upserted: 0, deleted: 0 })
  })

  it('a non-owner instructor is rejected', async () => {
    await setTestUser(INSTR2_EMAIL, PASSWORD)
    await expect(
      setGradeOverrides({ classId, entries: [{ studentId: studentAId, assessmentId, score: 10 }] }),
    ).rejects.toThrow()
  })

  it('a bonus score > 100 is stored unclamped', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)
    await setGradeOverrides({ classId, entries: [{ studentId: studentBId, assessmentId, score: 108 }] })
    const b = await readOverride(studentBId)
    expect(Number(b![0].score)).toBe(108)
  })
})
