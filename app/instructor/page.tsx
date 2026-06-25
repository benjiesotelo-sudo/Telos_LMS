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
    return (
      <>
        <header className="feu-header">
          <div className="feu-crest">T</div>
          <p className="feu-inst">Far Eastern University · Manila</p>
          <h1>Instructor</h1>
        </header>
        <div className="feu-wrap"><p className="feu-muted">Not signed in.</p></div>
      </>
    )
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
    <>
      <header className="feu-header">
        <div className="feu-crest">T</div>
        <p className="feu-inst">Far Eastern University · Manila</p>
        <h1>Instructor</h1>
      </header>
      <div className="feu-wrap">
        <ImportPanel />
        {course && period ? (
          <>
            <EnrollPanel courseId={course.id} periodId={period.id} />
            <AssignPanel courseId={course.id} periodId={period.id} />
          </>
        ) : (
          <div className="feu-card">
            <p className="feu-muted">Create a course + period to enroll and assign.</p>
          </div>
        )}
        <SubmissionsPanel rows={rows} />
      </div>
    </>
  )
}
