import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/server'

const admin = createAdminClient()

// Provision a throwaway instructor + course + period for constraint checks.
// Uses the admin client (RLS lands in Task 3); the 0001 trigger makes the profile.
async function newInstructor() {
  const email = `schema-${randomUUID()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'pw-' + randomUUID(),
    email_confirm: true,
    user_metadata: { role: 'instructor', full_name: 'Schema Test', status: 'active' },
  })
  expect(error).toBeNull()
  return data.user!.id
}

async function newStudent() {
  const email = `schema-stu-${randomUUID()}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'pw-' + randomUUID(),
    email_confirm: true,
    user_metadata: { role: 'student', full_name: 'Schema Stu', status: 'active' },
  })
  expect(error).toBeNull()
  return data.user!.id
}

describe('0001_init schema + constraints', () => {
  let instructorId: string
  let studentId: string
  let courseId: string
  let periodId: string

  beforeAll(async () => {
    instructorId = await newInstructor()
    studentId = await newStudent()

    const c = await admin
      .from('courses')
      .insert({ instructor_id: instructorId, code: 'SCHEMA101', title: 'Schema Course' })
      .select('id')
      .single()
    expect(c.error).toBeNull()
    courseId = c.data!.id

    const p = await admin
      .from('periods')
      .insert({ course_id: courseId, instructor_id: instructorId, label: '1st Semester' })
      .select('id')
      .single()
    expect(p.error).toBeNull()
    periodId = p.data!.id
  })

  it('auto-provisions a profiles row from the auth user via the trigger', async () => {
    const { data, error } = await admin
      .from('profiles')
      .select('id, role, status')
      .eq('id', instructorId)
      .single()
    expect(error).toBeNull()
    expect(data!.role).toBe('instructor')
    expect(data!.status).toBe('active')
  })

  it('rejects the period label CHECK constraint outside the canonical set', async () => {
    const { error } = await admin
      .from('periods')
      .insert({ course_id: courseId, instructor_id: instructorId, label: 'Quarter 1' })
    expect(error).not.toBeNull()
  })

  it('rejects a duplicate enrollment (student_id, course_id, period_id)', async () => {
    const first = await admin
      .from('enrollments')
      .insert({ student_id: studentId, course_id: courseId, period_id: periodId })
    expect(first.error).toBeNull()

    const dup = await admin
      .from('enrollments')
      .insert({ student_id: studentId, course_id: courseId, period_id: periodId })
    expect(dup.error).not.toBeNull()
    expect(dup.error!.code).toBe('23505') // unique_violation
  })

  it('rejects a second submission for the same (assignment_id, student_id)', async () => {
    const a = await admin
      .from('assessments')
      .insert({
        instructor_id: instructorId,
        title: 'A',
        type: 'quiz',
        total_points: 10,
        questions: [],
      })
      .select('id')
      .single()
    expect(a.error).toBeNull()

    const asg = await admin
      .from('assignments')
      .insert({
        assessment_id: a.data!.id,
        course_id: courseId,
        period_id: periodId,
        instructor_id: instructorId,
      })
      .select('id')
      .single()
    expect(asg.error).toBeNull()

    const s1 = await admin.from('submissions').insert({
      assignment_id: asg.data!.id,
      student_id: studentId,
      instructor_id: instructorId,
    })
    expect(s1.error).toBeNull()

    const s2 = await admin.from('submissions').insert({
      assignment_id: asg.data!.id,
      student_id: studentId,
      instructor_id: instructorId,
    })
    expect(s2.error).not.toBeNull()
    expect(s2.error!.code).toBe('23505')
  })
})

describe('seed.sql pilot scoping', () => {
  it('seeds zero pilot courses on a fresh stack (no out-of-band instructor present)', async () => {
    // A fresh local db reset runs seed.sql with NO benjiesotelo@gmail.com auth
    // user, so the guarded inserts NO-OP. Scope to the pilot code, never a global
    // count: sibling suites create their own courses against the same reset.
    const { data: bootstrap } = await admin.auth.admin.listUsers()
    const benji = bootstrap.users.find((u) => u.email === 'benjiesotelo@gmail.com')

    const { data: pilotCourses, error } = await admin
      .from('courses')
      .select('id, instructor_id')
      .eq('code', 'AMS0011')
    expect(error).toBeNull()

    if (!benji) {
      // No bootstrap user -> guarded inserts produced no pilot course.
      expect(pilotCourses!.length).toBe(0)
    } else {
      // If a bootstrap user does exist, the pilot course belongs to it and has a
      // 1st Semester period — still scoped to AMS0011, never a global count.
      expect(pilotCourses!.length).toBe(1)
      expect(pilotCourses![0].instructor_id).toBe(benji.id)
      const { data: periods, error: pErr } = await admin
        .from('periods')
        .select('label')
        .eq('course_id', pilotCourses![0].id)
      expect(pErr).toBeNull()
      expect(periods!.map((r) => r.label)).toContain('1st Semester')
    }
  })
})
