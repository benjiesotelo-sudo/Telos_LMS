'use client'
import { useState } from 'react'
import { approvePending } from '@/app/actions/approvePending'
import { rejectPending } from '@/app/actions/rejectPending'
import type { PendingRow } from '@/lib/types'

export function PendingPanel({ rows }: { rows: PendingRow[] }) {
  const [done, setDone] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, string>>({})
  async function act(id: string, fn: () => Promise<unknown>, pendingLabel: string, doneLabel: string) {
    setBusy((b) => ({ ...b, [id]: pendingLabel }))
    try { await fn(); setDone((d) => ({ ...d, [id]: doneLabel })) }
    catch (e) { setDone((d) => ({ ...d, [id]: `Error: ${e instanceof Error ? e.message : String(e)}` })) }
    finally { setBusy((b) => { const next = { ...b }; delete next[id]; return next }) }
  }
  return (
    <section aria-labelledby="pending-h" className="feu-card">
      <h2 id="pending-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Pending Registrations</h2>
      {rows.length === 0 && <p className="feu-muted">None pending.</p>}
      {rows.map((r) => (
        <div key={r.studentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line, #eee)' }}>
          <span>{r.fullName} · {r.email} · {r.studentNumber || '—'} · {r.className ?? 'unassigned'}</span>
          {done[r.studentId]
            ? <span className="feu-muted">{done[r.studentId]}</span>
            : busy[r.studentId]
              ? <span className="feu-muted" style={{ fontSize: 13 }}>{busy[r.studentId]}</span>
              : <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="feu-btn-green" onClick={() => act(r.studentId, () => approvePending({ studentId: r.studentId }), 'Approving…', 'Approved')}>Approve</button>
                  <button type="button" className="feu-btn-gold" onClick={() => act(r.studentId, () => rejectPending({ studentId: r.studentId }), 'Rejecting…', 'Rejected')}>Reject</button>
                </span>}
        </div>
      ))}
    </section>
  )
}
