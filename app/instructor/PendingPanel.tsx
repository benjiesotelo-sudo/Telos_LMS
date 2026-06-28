'use client'
import { useState } from 'react'
import { approvePending } from '@/app/actions/approvePending'
import { rejectPending } from '@/app/actions/rejectPending'
import type { PendingRow } from '@/lib/types'

interface ClassOption { id: string; displayName: string }

export function PendingPanel({ rows, classes }: { rows: PendingRow[]; classes: ClassOption[] }) {
  const [done, setDone] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, string>>({})
  // Per-row chosen class for unplaced (unassigned) registrants.
  const [pickedClass, setPickedClass] = useState<Record<string, string>>({})

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
      {rows.map((r) => {
        const unplaced = r.className == null
        const chosen = pickedClass[r.studentId] ?? ''
        // Unplaced registrants (general-link, no section) must be assigned a section before approval.
        const approveDisabled = unplaced && chosen === ''
        return (
          <div key={r.studentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line, #eee)', flexWrap: 'wrap' }}>
            <span>{r.fullName} · {r.email} · {r.studentNumber || '—'} · {r.className ?? 'unassigned'}</span>
            {done[r.studentId]
              ? <span className="feu-muted">{done[r.studentId]}</span>
              : busy[r.studentId]
                ? <span className="feu-muted" style={{ fontSize: 13 }}>{busy[r.studentId]}</span>
                : <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {unplaced && (
                      <select
                        value={chosen}
                        onChange={(e) => setPickedClass((p) => ({ ...p, [r.studentId]: e.target.value }))}
                        title="Pick a section to enroll this student in"
                        style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, maxWidth: 220 }}
                      >
                        <option value="">— pick a section —</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>{c.displayName}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="feu-btn-green"
                      disabled={approveDisabled}
                      style={approveDisabled ? { opacity: 0.5, cursor: 'default' } : undefined}
                      onClick={() => act(
                        r.studentId,
                        () => approvePending(unplaced ? { studentId: r.studentId, classId: chosen } : { studentId: r.studentId }),
                        'Approving…',
                        'Approved',
                      )}
                    >
                      Approve
                    </button>
                    <button type="button" className="feu-btn-gold" onClick={() => act(r.studentId, () => rejectPending({ studentId: r.studentId }), 'Rejecting…', 'Rejected')}>Reject</button>
                  </span>}
          </div>
        )
      })}
    </section>
  )
}
