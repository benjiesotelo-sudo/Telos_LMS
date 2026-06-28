import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentOverview } from '@/app/actions/getStudentData'

export default async function StudentClassesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { classes } = await getStudentOverview()

  return (
    <div className="feu-page">
      <h1>Classes</h1>
      <p className="feu-page-sub">Select a class to view its contents.</p>

      {classes.length === 0 ? (
        <p className="feu-muted">You are not enrolled in any classes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {classes.map((c) => {
            const todo = c.tasks.filter((t) => !t.submitted && !t.isManual && t.active).length
            return (
              <Link
                key={c.classId}
                href={`/student/classes/${c.classId}`}
                className="feu-card"
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 18, color: 'var(--green)' }}>{c.code} - {c.sectionLabel}</h2>
                  <span className="feu-muted" style={{ fontSize: 13 }}>{c.title}</span>
                </div>
                <div className="feu-muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {c.period ? `${c.period} · ` : ''}{c.tasks.length} task{c.tasks.length !== 1 ? 's' : ''}{todo > 0 ? ` · ${todo} to do` : ''}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
