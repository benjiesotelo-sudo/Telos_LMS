import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'
import { ImportPanel } from '@/app/instructor/ImportPanel'
import { AssignPanel } from '@/app/instructor/AssignPanel'

export default async function AssessmentsPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const classes = await listClasses()

  return (
    <div className="feu-page">
      <h1>Assessments</h1>
      <p className="feu-page-sub">Import assessments and assign them to your classes.</p>

      <ImportPanel />
      {classes.length > 0 ? (
        <AssignPanel classes={classes.map((c) => ({ id: c.id, displayName: c.displayName }))} />
      ) : (
        <div className="feu-card">
          <p className="feu-muted">Create a course + class to assign assessments.</p>
        </div>
      )}
    </div>
  )
}
