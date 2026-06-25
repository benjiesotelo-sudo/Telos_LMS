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
    .select('course_id, period_id')

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
      .eq('course_id', e.course_id)
      .eq('period_id', e.period_id)
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

  return (
    <main style={{ padding: 24 }}>
      <h1>Your assessments</h1>
      {assignments.length === 0 ? (
        <p>No assessments assigned yet.</p>
      ) : (
        <ul>
          {assignments.map((a) => (
            <li key={a.id}>
              <Link href={`/student/take/${a.id}`}>
                {a.title} ({a.type})
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
