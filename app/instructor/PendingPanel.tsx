'use client'
import { useState } from 'react'
import { approvePending } from '@/app/actions/approvePending'
import { rejectPending } from '@/app/actions/rejectPending'
import type { PendingRow } from '@/lib/types'

interface ClassOption { id: string; displayName: string }

export function PendingPanel({ rows, classes }: { rows: PendingRow[]; classes: ClassOption[] }) {
  const [done, setDone] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, string>>({})
  const [pickedClass, setPickedClass] = useState<Record<string, string>>({})

  async function act(id: string, fn: () => Promise<unknown>, pendingLabel: string, doneLabel: string) {
    setBusy((b) => ({ ...b, [id]: pendingLabel }))
    try { await fn(); setDone((d) => ({ ...d, [id]: doneLabel })) }
    catch (e) { setDone((d) => ({ ...d, [id]: `Error: ${e instanceof Error ? e.message : String(e)}` })) }
    finally { setBusy((b) => { const next = { ...b }; delete next[id]; return next }) }
  }

  // Two meaningful groups: those who still need a section, and those who already joined one.
  const needsSection = rows.filter((r) => r.className == null)
  const joined = rows.filter((r) => r.className != null)

  function Row({ r, unplaced }: { r: PendingRow; unplaced: boolean }) {
    const chosen = pickedClass[r.studentId] ?? ''
    const approveDisabled = unplaced && chosen === ''
    return (
      <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line, #eee)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{r.fullName || <span className="feu-muted">(no name)</span>}</div>
            <div className="feu-muted" style={{ fontSize: 12 }}>
              {r.studentNumber || '—'} · {r.email}{r.className ? ` · ${r.className}` : ''}
            </div>
            {r.reason && (
              <div style={{ fontSize: 12, marginTop: 4, color: 'var(--ink)' }}>
                <span className="feu-muted">Reason:</span> {r.reason}
              </div>
            )}
          </div>
          {done[r.studentId]
            ? <span className="feu-muted">{done[r.studentId]}</span>
            : busy[r.studentId]
              ? <span className="feu-muted" style={{ fontSize: 13 }}>{busy[r.studentId]}</span>
              : <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {unplaced && (
                    <select
                      value={chosen}
                      onChange={(e) => setPickedClass((p) => ({ ...p, [r.studentId]: e.target.value }))}
                      title="Pick a section to enroll this student in"
                      style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, maxWidth: 200 }}
                    >
                      <option value="">— pick a section —</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                    </select>
                  )}
                  <button type="button" className="feu-btn-green" disabled={approveDisabled}
                    style={{ fontSize: 13, padding: '5px 12px', ...(approveDisabled ? { opacity: 0.5, cursor: 'default' } : {}) }}
                    onClick={() => act(r.studentId, () => approvePending(unplaced ? { studentId: r.studentId, classId: chosen } : { studentId: r.studentId }), 'Approving…', 'Approved')}>
                    Approve
                  </button>
                  <button type="button" className="feu-btn-gold" style={{ fontSize: 13, padding: '5px 12px' }}
                    onClick={() => act(r.studentId, () => rejectPending({ studentId: r.studentId }), 'Rejecting…', 'Rejected')}>
                    Reject
                  </button>
                </span>}
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="pending-h" className="feu-card">
      <h2 id="pending-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Pending Registrations</h2>
      {rows.length === 0 && <p className="feu-muted">None pending.</p>}

      {needsSection.length > 0 && (
        <div style={{ marginBottom: joined.length > 0 ? 18 : 0 }}>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gold-dk)', margin: '0 0 4px' }}>
            Needs a section ({needsSection.length})
          </h3>
          <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 6px' }}>Joined via a general link — pick a section before approving.</p>
          {needsSection.map((r) => <Row key={r.studentId} r={r} unplaced />)}
        </div>
      )}

      {joined.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--green)', margin: '0 0 6px' }}>
            Joined a section ({joined.length})
          </h3>
          {joined.map((r) => <Row key={r.studentId} r={r} unplaced={false} />)}
        </div>
      )}
    </section>
  )
}
