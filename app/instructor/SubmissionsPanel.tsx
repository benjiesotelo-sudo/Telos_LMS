import { computeFinal } from '@/lib/grading'
import type { ComponentSubmission, ComponentType, ComponentWeights } from '@/lib/types'

const DEFAULT_WEIGHTS: ComponentWeights = { activity: 10, quiz: 40, exam: 50 }

export interface RosterRow {
  submissionId: string
  studentId: string
  studentName: string
  type: ComponentType
  earned: number
  possible: number
  score: number | null
}

function pct(earned: number, possible: number): string {
  if (possible === 0) return '—'
  return `${Math.round((earned / possible) * 100)}%`
}

export function SubmissionsPanel({ rows }: { rows: RosterRow[] }) {
  const byStudent = new Map<string, { name: string; rows: RosterRow[] }>()
  for (const r of rows) {
    const g = byStudent.get(r.studentId) ?? { name: r.studentName, rows: [] }
    g.rows.push(r)
    byStudent.set(r.studentId, g)
  }

  return (
    <section aria-labelledby="subs-h" className="feu-card">
      <h2 id="subs-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
        Submissions &amp; Grades
      </h2>
      {byStudent.size === 0 && (
        <p className="feu-muted">No submissions yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[...byStudent.entries()].map(([studentId, g]) => {
          const compSubs: ComponentSubmission[] = g.rows.map((r) => ({
            type: r.type,
            earned: r.earned,
            possible: r.possible,
          }))
          const rollup = computeFinal(compSubs, DEFAULT_WEIGHTS)

          return (
            <div key={studentId} style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              {/* Student name */}
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>
                {g.name || <span className="feu-muted">Unknown student</span>}
              </p>

              {/* Submissions table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f1f7f3' }}>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Score</th>
                      <th style={thStyle}>Earned / Possible</th>
                      <th style={thStyle}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.submissionId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: 'var(--gray)',
                          }}>
                            {r.type}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {r.score == null ? (
                            <span className="feu-muted">—</span>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{r.score.toFixed(2)}</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {r.earned} / {r.possible}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            fontWeight: 600,
                            color: pct(r.earned, r.possible) === '—'
                              ? 'var(--gray)'
                              : 'var(--green)',
                          }}>
                            {pct(r.earned, r.possible)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Final rollup summary */}
              <div style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: rollup.complete ? '#f1f7f3' : '#fefce8',
                borderRadius: 6,
                border: `1px solid ${rollup.complete ? 'var(--border)' : 'var(--gold)'}`,
              }}>
                <span style={{ fontSize: 13, color: 'var(--gray)', flex: 1 }}>
                  {rollup.complete ? 'Final grade' : 'Provisional grade (incomplete)'}
                </span>
                <span style={{
                  fontWeight: 700,
                  fontSize: 16,
                  color: rollup.complete ? 'var(--green)' : 'var(--gold-dk)',
                }}>
                  {rollup.complete
                    ? rollup.final.toFixed(2)
                    : rollup.provisional.toFixed(2)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 10px',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  color: '#3c5a48',
  borderBottom: '1px solid var(--border)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: 'var(--ink)',
}
