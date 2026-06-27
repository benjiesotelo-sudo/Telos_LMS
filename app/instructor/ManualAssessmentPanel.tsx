'use client'
import { useState } from 'react'
import { createManualAssessment } from '@/app/actions/createManualAssessment'

type AssessmentType = 'activity' | 'quiz' | 'exam'

export function ManualAssessmentPanel() {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<AssessmentType>('activity')
  const [totalPoints, setTotalPoints] = useState(100)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onCreate() {
    setBusy(true)
    setMsg('')
    try {
      const { assessmentId } = await createManualAssessment({ title, type, totalPoints })
      setMsg(
        `Created assessment ${assessmentId}. Now assign it to a class below (paste this id into Assign).`,
      )
      setTitle('')
      setType('activity')
      setTotalPoints(100)
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="manual-h" className="feu-card">
      <h2 id="manual-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
        Create Manual Assessment
      </h2>

      <label className="feu-label" htmlFor="manual-name">Name</label>
      <input
        id="manual-name"
        type="text"
        className="feu-input"
        placeholder="e.g. Homework 3"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ marginBottom: 10 }}
      />

      <label className="feu-label" htmlFor="manual-type">Type</label>
      <select
        id="manual-type"
        className="feu-input"
        value={type}
        onChange={(e) => setType(e.target.value as AssessmentType)}
        style={{ marginBottom: 10 }}
      >
        <option value="activity">Homework / Activity</option>
        <option value="quiz">Quiz</option>
        <option value="exam">Exam</option>
      </select>

      <label className="feu-label" htmlFor="manual-points">Total points</label>
      <input
        id="manual-points"
        type="number"
        className="feu-input"
        min={1}
        value={totalPoints}
        onChange={(e) => setTotalPoints(Number(e.target.value))}
        style={{ marginBottom: 12 }}
      />

      <div style={{ marginTop: 4 }}>
        <button
          type="button"
          className="feu-btn-gold"
          onClick={onCreate}
          disabled={busy || !title.trim()}
        >
          {busy ? 'Creating…' : 'Create'}
        </button>
      </div>

      {msg && (
        <p
          role="status"
          className={msg.startsWith('Error:') ? 'feu-error' : 'feu-muted'}
          style={{ marginTop: 10 }}
        >
          {msg}
        </p>
      )}
    </section>
  )
}
