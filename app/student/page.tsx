import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentOverview } from '@/app/actions/getStudentData'
import { GroupedTaskList } from './TaskList'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { classes } = await getStudentOverview()

  return (
    <div className="feu-page">
      <h1>Dashboard</h1>
      <p className="feu-page-sub">Your classes and what&apos;s due.</p>

      {classes.length === 0 ? (
        <p className="feu-muted">You are not enrolled in any classes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {classes.map((c) => {
            const todo = c.tasks.filter((t) => !t.submitted && !t.isManual && t.active).length
            return (
              <div key={c.classId} className="feu-card">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
                  <h2 style={{ margin: 0, fontSize: 18, color: 'var(--green)' }}>
                    {c.code} - {c.sectionLabel}
                  </h2>
                  <span className="feu-muted" style={{ fontSize: 13 }}>{c.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <span className="feu-muted" style={{ fontSize: 12 }}>
                    {todo} to do · {c.tasks.length} total
                  </span>
                  <Link href={`/student/classes/${c.classId}`} className="feu-btn-outline" style={{ fontSize: 12, padding: '3px 10px' }}>
                    Open class
                  </Link>
                </div>
                {c.tasks.length === 0 ? (
                  <p className="feu-muted" style={{ fontSize: 13 }}>No assessments yet.</p>
                ) : (
                  <GroupedTaskList tasks={c.tasks} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
