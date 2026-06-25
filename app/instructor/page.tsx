import { createClient } from '@/lib/supabase/server'
import { ImportPanel } from '@/app/instructor/ImportPanel'
import { EnrollPanel } from '@/app/instructor/EnrollPanel'
import { AssignPanel } from '@/app/instructor/AssignPanel'
import { SubmissionsPanel, type RosterRow } from '@/app/instructor/SubmissionsPanel'
import type { ComponentType } from '@/lib/types'

export default async function InstructorPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    return <main><p>Not signed in.</p></main>
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, code, title')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: period } = course
    ? await supabase
        .from('periods')
        .select('id, label')
        .eq('course_id', course.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const { data: subData } = await supabase
    .from('submissions')
    .select('id, student_id, earned, possible, score, profiles:student_id(full_name), assignments:assignment_id(assessment:assessment_id(type))')
    .order('created_at', { ascending: true })

  const rows: RosterRow[] = (subData ?? []).map((s: any) => ({
    submissionId: s.id,
    studentId: s.student_id,
    studentName: s.profiles?.full_name ?? '',
    type: (s.assignments?.assessment?.type ?? 'activity') as ComponentType,
    earned: s.earned ?? 0,
    possible: s.possible ?? 0,
    score: s.score ?? null,
  }))

  return (
    <main>
      <h1>Instructor</h1>
      <ImportPanel />
      {course && period ? (
        <>
          <EnrollPanel courseId={course.id} periodId={period.id} />
          <AssignPanel courseId={course.id} periodId={period.id} />
        </>
      ) : (
        <p>Create a course + period to enroll and assign.</p>
      )}
      <SubmissionsPanel rows={rows} />
    </main>
  )
}
