import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'
import { ImportPanel } from '@/app/instructor/ImportPanel'
import { AssignPanel } from '@/app/instructor/AssignPanel'

const typeLabel: Record<string, string> = {
  quiz:     'Quiz',
  activity: 'Paper / Activity',
  exam:     'Exam',
}

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(assessments ?? []).map((a) => (
              <Link
                key={a.id}
                href={`/instructor/assessments/${a.id}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 0',
                  borderBottom: '1px solid var(--line, #eee)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: 'var(--gray)',
                      padding: '1px 6px',
                      border: '1px solid var(--line, #e2e8e4)',
                      borderRadius: 3,
                    }}
                  >
                    {typeLabel[a.type] ?? a.type}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--green)',
                      fontWeight: 500,
                    }}
                  >
                    Preview / answers &rarr;
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
