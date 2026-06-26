// tests/grade-overrides.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUser, seedCourse, seedClass } from '@/tests/helpers/fixtures'
import { setTestUser } from '@/tests/helpers/auth'
import { importAssessment } from '@/app/actions/importAssessment'
import { setGradeOverride } from '@/app/actions/setGradeOverride'
import type { AssessmentImport } from '@/lib/types'

const quiz1: AssessmentImport = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/quiz-1.json', import.meta.url)), 'utf-8'),
)

const PASSWORD = 'Passw0rd!go'
const INSTR_EMAIL = 'go-instr@telos.test'
const INSTR2_EMAIL = 'go-instr2@telos.test'

let instructorId: string
let instructor2Id: string
let studentId: string
let assessmentId: string
let classId: string

beforeAll(async () => {
  const instr = await createUser({
    role: 'instructor',
    email: INSTR_EMAIL,
    password: PASSWORD,
    fullName: 'GO Instructor',
  })
  instructorId = instr.id

  const instr2 = await createUser({
    role: 'instructor',
    email: INSTR2_EMAIL,
    password: PASSWORD,
    fullName: 'GO Instructor 2',
  })
  instructor2Id = instr2.id

  const stu = await createUser({
    role: 'student',
    email: 'go-student@telos.test',
    password: PASSWORD,
    fullName: 'GO Student',
    studentNumber: '20240001',
  })
  studentId = stu.id

  await setTestUser(INSTR_EMAIL, PASSWORD)
  const imported = await importAssessment(quiz1)
  assessmentId = imported.assessmentId

  const course = await seedCourse({ instructorId, code: 'GO101', title: 'GO Course' })
  const cls = await seedClass({ instructorId, courseId: course.id, period: '1st Semester' })
  classId = cls.id
})

describe('setGradeOverride', () => {
  it('owner can set a grade override and read it back', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)

    const result = await setGradeOverride({
      studentId,
      assessmentId,
      classId,
      score: 88,
      note: 'Offline paper graded manually',
    })
    expect(result.ok).toBe(true)

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data, error } = await admin
      .from('grade_overrides')
      .select('*')
      .eq('student_id', studentId)
      .eq('assessment_id', assessmentId)
      .eq('class_id', classId)
    if (error) throw error

    expect(data).toHaveLength(1)
    expect(Number(data![0].score)).toBe(88)
    expect(data![0].note).toBe('Offline paper graded manually')
    expect(data![0].instructor_id).toBe(instructorId)
  })

  it('second call for same (student, assessment, class) UPDATES the row — no duplicate', async () => {
    await setTestUser(INSTR_EMAIL, PASSWORD)

    // Set initial override (may already exist from previous test — that is fine)
    await setGradeOverride({ studentId, assessmentId, classId, score: 70, note: 'first' })
    // Update with a new score
    await setGradeOverride({ studentId, assessmentId, classId, score: 95, note: 'revised' })

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data, error } = await admin
      .from('grade_overrides')
      .select('*')
      .eq('student_id', studentId)
      .eq('assessment_id', assessmentId)
      .eq('class_id', classId)
    if (error) throw error

    // Must be exactly ONE row (upsert, not duplicate insert)
    expect(data).toHaveLength(1)
    expect(Number(data![0].score)).toBe(95)
    expect(data![0].note).toBe('revised')
  })

  it('a non-owner instructor is rejected', async () => {
    await setTestUser(INSTR2_EMAIL, PASSWORD)

    await expect(
      setGradeOverride({ studentId, assessmentId, classId, score: 50 }),
    ).rejects.toThrow()
  })

  it('a bonus score > 100 is stored as-is (not clamped)', async () => {
    // Use a fresh student so there's no existing override for this combination
    const bonusStu = await createUser({
      role: 'student',
      email: 'go-bonus-student@telos.test',
      password: PASSWORD,
      fullName: 'GO Bonus Student',
      studentNumber: '20240002',
    })

    await setTestUser(INSTR_EMAIL, PASSWORD)
    await setGradeOverride({
      studentId: bonusStu.id,
      assessmentId,
      classId,
      score: 105,
      note: 'bonus points awarded',
    })

    const admin = (await import('@/lib/supabase/server')).createAdminClient()
    const { data, error } = await admin
      .from('grade_overrides')
      .select('score')
      .eq('student_id', bonusStu.id)
      .eq('assessment_id', assessmentId)
      .eq('class_id', classId)
      .single()
    if (error) throw error

    expect(Number(data!.score)).toBe(105)
  })
})
