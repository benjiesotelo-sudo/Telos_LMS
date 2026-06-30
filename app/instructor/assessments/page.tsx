import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'
import { ImportPanel } from '@/app/instructor/ImportPanel'
import { ManualAssessmentPanel } from '@/app/instructor/ManualAssessmentPanel'
import { AssignPanel } from '@/app/instructor/AssignPanel'
import { AssessmentsList } from '@/app/instructor/assessments/AssessmentsList'

export default async function AssessmentsPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const classes = await listClasses()

  // List the caller's own assessments (RLS filters to instructor_id = auth.uid())
  const { data: assessments } = await supabase
    .from('assessments')
    .select('id, title, type, total_points, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="feu-page">
      <h1>Assessments</h1>
      <p className="feu-page-sub">Import assessments and assign them to your classes.</p>

      {/* ── Existing assessments list ───────────────────────────────────────── */}
      {(assessments ?? []).length > 0 && (
        <section className="feu-card" aria-labelledby="my-assessments-h" style={{ marginBottom: 20 }}>
          <h2
            id="my-assessments-h"
            style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}
          >
            My Assessments
          </h2>
          <AssessmentsList
            assessments={(assessments ?? []).map((a) => ({ id: a.id, title: a.title, type: a.type }))}
          />
        </section>
      )}

      <ImportPanel />
      <ManualAssessmentPanel />
      {classes.length > 0 ? (
        <AssignPanel
          classes={classes.map((c) => ({ id: c.id, displayName: c.displayName }))}
          assessments={(assessments ?? []).map((a) => ({ id: a.id, title: a.title, type: a.type }))}
        />
      ) : (
        <div className="feu-card">
          <p className="feu-muted">Create a course + class to assign assessments.</p>
        </div>
      )}
    </div>
  )
}
