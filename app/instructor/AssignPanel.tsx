'use client'
import { useState } from 'react'
import { createAssignment } from '@/app/actions/createAssignment'

export function AssignPanel({ classId }: { classId: string }) {
  const [assessmentId, setAssessmentId] = useState('')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onAssign() {
    setBusy(true)
    setMsg('')
    try {
      const res = await createAssignment({
        assessmentId,
        classId,
        opensAt: opensAt ? new Date(opensAt).toISOString() : undefined,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      })
      setMsg(`Assigned (${res.assignmentId})`)
      setAssessmentId('')
      setOpensAt('')
      setClosesAt('')
    } catch (e) {
      setMsg(`Assign failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="assign-h" className="feu-card">
      <h2 id="assign-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
        Assign to Class
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="feu-label" htmlFor="assign-id">Assessment ID</label>
          <input
            id="assign-id"
            aria-label="Assessment id"
            className="feu-input"
            value={assessmentId}
            onChange={(e) => setAssessmentId(e.target.value)}
            placeholder="Assessment id"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="feu-label" htmlFor="assign-opens">Opens At</label>
            <input
              id="assign-opens"
              aria-label="Opens at"
              className="feu-input"
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </div>
          <div>
            <label className="feu-label" htmlFor="assign-closes">Closes At</label>
            <input
              id="assign-closes"
              aria-label="Closes at"
              className="feu-input"
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className="feu-btn-gold"
          onClick={onAssign}
          disabled={busy || !assessmentId.trim()}
        >
          {busy ? 'Assigning...' : 'Assign'}
        </button>
      </div>
      {msg && (
        <p
          role="status"
          className={msg.startsWith('Assign failed') ? 'feu-error' : 'feu-muted'}
          style={{ marginTop: 10 }}
        >
          {msg}
        </p>
      )}
    </section>
  )
}
