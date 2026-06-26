import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <main style={{ padding: 24 }}><p>Please sign in.</p></main>
  }

  // RLS returns only the caller's enrollments.
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id')

  const assignments: {
    id: string
    title: string
    type: string
    opens_at: string | null
    closes_at: string | null
  }[] = []

  for (const e of enrollments ?? []) {
    const { data: rows } = await supabase
      .from('assignments')
      .select('id, opens_at, closes_at, assessments(title, type)')
      .eq('class_id', e.class_id)
    for (const r of rows ?? []) {
      const a = r as unknown as {
        id: string
        opens_at: string | null
        closes_at: string | null
        assessments: { title: string; type: string }
      }
      assignments.push({
        id: a.id,
        title: a.assessments.title,
        type: a.assessments.type,
        opens_at: a.opens_at,
        closes_at: a.closes_at,
      })
    }
  }

  // RLS scopes this to the logged-in student automatically.
  const { data: subs } = await supabase
    .from('submissions')
    .select('id, assignment_id')
    .eq('status', 'graded')

  const submissionMap = new Map(subs?.map(s => [s.assignment_id, s.id]) ?? [])

  return (
    <div className="feu-page">
      <h1>Dashboard</h1>
      <p className="feu-page-sub">Your assigned assessments.</p>

      {assignments.length === 0 ? (
        <p className="feu-muted">No assessments assigned yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {assignments.map((a) => {
            const submissionId = submissionMap.get(a.id)
            const isCompleted = submissionMap.has(a.id)
            return (
              <div key={a.id} className="feu-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{a.title}</h2>
                  {isCompleted && (
                    <span style={{
                      fontSize: 12,
                      color: 'var(--green)',
                      fontWeight: 600,
                      border: '1px solid var(--green)',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}>
                      Completed
                    </span>
                  )}
                </div>
                <p className="feu-muted" style={{ margin: '0 0 12px' }}>
                  Type: {a.type}
                </p>
                {isCompleted ? (
                  <Link href={`/student/results/${submissionId}`} className="feu-btn-outline">
                    View result
                  </Link>
                ) : (
                  <Link href={`/student/take/${a.id}`} className="feu-btn-gold">
                    Take assessment
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
