import { createClient } from '@/lib/supabase/server'
import { ImportPanel } from '@/app/instructor/ImportPanel'
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

  const { data: cls } = await supabase
    .from('classes')
    .select('id, period, courses(code, title)')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

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
        {cls ? (
          <AssignPanel classId={cls.id} />
        ) : (
          <div className="feu-card">
            <p className="feu-muted">Create a course + class to assign assessments.</p>
          </div>
        )}
        <SubmissionsPanel rows={rows} />
      </div>
    </>
  )
}
