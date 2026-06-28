'use client'
import { useState } from 'react'
import { createAssignment } from '@/app/actions/createAssignment'
import { typeName } from '@/lib/assessmentType'

export function AssignPanel({
  classes,
  assessments,
}: {
  classes: { id: string; displayName: string }[]
  assessments: { id: string; title: string; type: string }[]
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [assessmentId, setAssessmentId] = useState('')
  const [period, setPeriod] = useState<'midterm' | 'final'>('midterm')
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [duration, setDuration] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onAssign() {
    setBusy(true)
    setMsg('')
    try {
      const t = duration.trim()
      const minutes = t === '' ? undefined : parseFloat(t) // undefined = inherit assessment default
      if (minutes !== undefined && (isNaN(minutes) || minutes <= 0)) {
        setMsg('Assign failed: time limit must be a positive number')
        setBusy(false)
        return
      }
      const res = await createAssignment({
        assessmentId,
        classId,
        period,
        opensAt: opensAt ? new Date(opensAt).toISOString() : undefined,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
        durationMinutes: minutes,
      })
      setMsg(`Assigned (${res.assignmentId})`)
      setAssessmentId('')
      setOpensAt('')
      setClosesAt('')
      setDuration('')
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
          <label className="feu-label" htmlFor="assign-class">Class (Section)</label>
          <select
            id="assign-class"
            aria-label="Class"
            className="feu-input"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="feu-label" htmlFor="assign-id">Assessment</label>
          <select
            id="assign-id"
            aria-label="Assessment"
            className="feu-input"
            value={assessmentId}
            onChange={(e) => setAssessmentId(e.target.value)}
          >
            <option value="">— select an assessment —</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({typeName(a.type)})
              </option>
            ))}
          </select>
          {assessments.length === 0 && (
            <p className="feu-muted" style={{ marginTop: 6 }}>
              No assessments yet — import one or create a manual assessment above.
            </p>
          )}
        </div>
        <div>
          <label className="feu-label" htmlFor="assign-period">Period</label>
          <select
            id="assign-period"
            aria-label="Period"
            className="feu-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'midterm' | 'final')}
          >
            <option value="midterm">Midterm</option>
            <option value="final">Final</option>
          </select>
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
        <div>
          <label className="feu-label" htmlFor="assign-duration">Time limit (minutes)</label>
          <input
            id="assign-duration"
            aria-label="Time limit in minutes"
            className="feu-input"
            type="number"
            min={1}
            step={1}
            placeholder="blank = use assessment default / untimed"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className="feu-btn-gold"
          onClick={onAssign}
          disabled={busy || !classId || !assessmentId.trim()}
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
