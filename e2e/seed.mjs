// e2e/seed.mjs — seed the LOCAL supabase with a known admin + demo data for headless smoke tests.
import { createClient } from '@supabase/supabase-js'

const URL = 'http://127.0.0.1:54321'
const SERVICE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

export const ADMIN_EMAIL = 'e2e-admin@local.test'
export const ADMIN_PASSWORD = 'E2e_admin_pass123!'

async function mkUser(email, role, full) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { role, status: 'active', full_name: full, first_name: full.split(' ')[0], last_name: full.split(' ').slice(-1)[0], student_number: role === 'student' ? 'E2E-001' : '' },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  return data.user.id
}

async function main() {
  const adminId = await mkUser(ADMIN_EMAIL, 'admin', 'E2E Admin')
  const studentId = await mkUser('e2e-student@local.test', 'student', 'Test Student')

  const { data: course, error: cErr } = await admin.from('courses').insert({ instructor_id: adminId, code: 'E2E101', title: 'E2E Course', description: 'demo' }).select('id').single()
  if (cErr) throw new Error(`course: ${cErr.message}`)
  const { data: cls, error: clErr } = await admin.from('classes').insert({ instructor_id: adminId, course_id: course.id, period: '1st Semester', section_label: '1', pic: 'PIC' }).select('id').single()
  if (clErr) throw new Error(`class: ${clErr.message}`)
  await admin.from('enrollments').insert({ student_id: studentId, class_id: cls.id, status: 'active' })

  const { data: assm, error: aErr } = await admin.from('assessments').insert({ instructor_id: adminId, title: 'Quiz 1', type: 'quiz', total_points: 1, questions: [{ id: 'q1', kind: 'num', prompt: '1+1?', points: 1, is_bonus: false }] }).select('id').single()
  if (aErr) throw new Error(`assessment: ${aErr.message}`)
  await admin.from('assessment_keys').insert({ assessment_id: assm.id, answer_key: { q1: { value: '2', points: 1, is_bonus: false } } })
  const { data: asg, error: asgErr } = await admin.from('assignments').insert({ assessment_id: assm.id, class_id: cls.id, instructor_id: adminId, period: 'midterm', active: true }).select('id').single()
  if (asgErr) throw new Error(`assignment: ${asgErr.message}`)
  await admin.from('submissions').insert({ assignment_id: asg.id, student_id: studentId, instructor_id: adminId, answers: { q1: '2' }, earned: 1, possible: 1, score: 100, status: 'graded' })

  // A MANUAL assessment (offline 100-pt homework) assigned to the class + a manual grade override.
  const { data: man, error: mErr } = await admin.from('assessments').insert({ instructor_id: adminId, title: 'Homework 1 (manual)', type: 'activity', total_points: 100, questions: [], is_manual: true }).select('id').single()
  if (mErr) throw new Error(`manual assessment: ${mErr.message}`)
  await admin.from('assignments').insert({ assessment_id: man.id, class_id: cls.id, instructor_id: adminId, period: 'midterm', active: true })
  await admin.from('grade_overrides').insert({ student_id: studentId, assessment_id: man.id, class_id: cls.id, score: 85, note: 'face-to-face', instructor_id: adminId })

  console.log(JSON.stringify({ adminId, studentId, courseId: course.id, classId: cls.id, assignmentId: asg.id, manualAssessmentId: man.id }, null, 2))
  console.log('SEED_OK')
}
main().catch((e) => { console.error('SEED_FAIL', e.message); process.exit(1) })
