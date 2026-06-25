'use client'
import { useState } from 'react'
import { createAssignment } from '@/app/actions/createAssignment'

export function AssignPanel({ courseId, periodId }: { courseId: string; periodId: string }) {
  const [assessmentId, setAssessmentId] = useState('')
  const [pic, setPic] = useState('')
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
        courseId,
        periodId,
        pic,
        opensAt: opensAt ? new Date(opensAt).toISOString() : undefined,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      })
      setMsg(`Assigned (${res.assignmentId})`)
      setAssessmentId('')
      setPic('')
      setOpensAt('')
      setClosesAt('')
    } catch (e) {
      setMsg(`Assign failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="assign-h">
      <h2 id="assign-h">Assign to class</h2>
      <input aria-label="Assessment id" value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} placeholder="Assessment id" />
      <input aria-label="Person in charge" value={pic} onChange={(e) => setPic(e.target.value)} placeholder="Person in charge (PIC)" />
      <label>Opens<input aria-label="Opens at" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></label>
      <label>Closes<input aria-label="Closes at" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></label>
      <button type="button" onClick={onAssign} disabled={busy || !assessmentId.trim()}>
        {busy ? 'Assigning...' : 'Assign'}
      </button>
      {msg && <p role="status">{msg}</p>}
    </section>
  )
}
