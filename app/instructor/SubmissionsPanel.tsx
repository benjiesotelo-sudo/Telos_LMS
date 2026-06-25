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

export function SubmissionsPanel({ rows }: { rows: RosterRow[] }) {
  const byStudent = new Map<string, { name: string; rows: RosterRow[] }>()
  for (const r of rows) {
    const g = byStudent.get(r.studentId) ?? { name: r.studentName, rows: [] }
    g.rows.push(r)
    byStudent.set(r.studentId, g)
  }

  return (
    <section aria-labelledby="subs-h">
      <h2 id="subs-h">Submissions</h2>
      {byStudent.size === 0 && <p>No submissions yet.</p>}
      {[...byStudent.entries()].map(([studentId, g]) => {
        const compSubs: ComponentSubmission[] = g.rows.map((r) => ({ type: r.type, earned: r.earned, possible: r.possible }))
        const rollup = computeFinal(compSubs, DEFAULT_WEIGHTS)
        return (
          <div key={studentId}>
            <h3>{g.name}</h3>
            <table>
              <thead>
                <tr><th>Type</th><th>Earned</th><th>Possible</th><th>Score</th></tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.submissionId}>
                    <td>{r.type}</td>
                    <td>{r.earned}</td>
                    <td>{r.possible}</td>
                    <td>{r.score == null ? '—' : r.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {rollup.complete
                ? `Final: ${rollup.final.toFixed(2)}`
                : `Provisional: ${rollup.provisional.toFixed(2)} (incomplete)`}
            </p>
          </div>
        )
      })}
    </section>
  )
}
