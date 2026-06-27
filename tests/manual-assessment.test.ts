import { describe, it, expect, beforeAll } from 'vitest'
import { createAdminClient } from '@/lib/supabase/server'
import { setTestUser } from '@/tests/helpers/auth'
import { createUser } from '@/tests/helpers/fixtures'
import { createManualAssessment } from '@/app/actions/createManualAssessment'

const PW = 'Passw0rd!manual'

describe('createManualAssessment', () => {
  let instructorEmail: string
  let studentEmail: string

  beforeAll(async () => {
    instructorEmail = `instructor.manual.${Date.now()}@telos.test`
    studentEmail = `student.manual.${Date.now()}@telos.test`
    await createUser({ role: 'instructor', email: instructorEmail, password: PW, fullName: 'Manual Inst' })
    await createUser({ role: 'student', email: studentEmail, password: PW, fullName: 'Manual Student' })
  })

  it('owner creates a manual assessment: is_manual=true, questions=[], total_points correct, instructor_id=caller', async () => {
    await setTestUser(instructorEmail, PW)
    const { assessmentId } = await createManualAssessment({
      title: 'Homework 3',
      type: 'activity',
      totalPoints: 50,
    })
    expect(assessmentId).toBeTruthy()

    const admin = createAdminClient()
    const { data: row } = await admin
      .from('assessments')
      .select('instructor_id, title, type, total_points, questions, is_manual')
      .eq('id', assessmentId)
      .single()
    expect(row).toBeTruthy()
    expect(row!.title).toBe('Homework 3')
    expect(row!.type).toBe('activity')
    expect(row!.total_points).toBe(50)
    expect(row!.is_manual).toBe(true)
    expect(row!.questions).toEqual([])

    // No answer_keys row
    const { data: keyRow } = await admin
      .from('assessment_keys')
      .select('id')
      .eq('assessment_id', assessmentId)
      .maybeSingle()
    expect(keyRow).toBeNull()

    // instructor_id matches caller
    const { data: { user } } = await (await (await import('@/lib/supabase/server')).createClient()).auth.getUser()
    expect(row!.instructor_id).toBe(user!.id)
  })

  it('rejects an invalid type', async () => {
    await setTestUser(instructorEmail, PW)
    await expect(
      createManualAssessment({ title: 'Bad Type', type: 'invalid' as never, totalPoints: 10 })
    ).rejects.toThrow(/type/i)
  })

  it('rejects an empty title', async () => {
    await setTestUser(instructorEmail, PW)
    await expect(
      createManualAssessment({ title: '   ', type: 'quiz', totalPoints: 10 })
    ).rejects.toThrow(/title/i)
  })

  it('rejects non-positive total points', async () => {
    await setTestUser(instructorEmail, PW)
    await expect(
      createManualAssessment({ title: 'Zero Points', type: 'exam', totalPoints: 0 })
    ).rejects.toThrow(/total.*points|points.*positive/i)
    await expect(
      createManualAssessment({ title: 'Negative Points', type: 'exam', totalPoints: -5 })
    ).rejects.toThrow(/total.*points|points.*positive/i)
  })

  it('rejects a non-instructor (student)', async () => {
    await setTestUser(studentEmail, PW)
    await expect(
      createManualAssessment({ title: 'Student Attempt', type: 'quiz', totalPoints: 20 })
    ).rejects.toThrow(/instructor|admin|forbidden/i)
  })
})
