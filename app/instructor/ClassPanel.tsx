'use client'
import { useState } from 'react'
import { createClass } from '@/app/actions/createClass'

const PERIODS = ['1st Semester', '2nd Semester', 'Midyear', 'Special Course']

export function ClassPanel({ courses, pics }: { courses: { id: string; code: string }[]; pics: string[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [period, setPeriod] = useState('Midyear')
  const [sectionLabel, setSectionLabel] = useState('')
  const [pic, setPic] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onCreate() {
    setBusy(true); setMsg('')
    try {
      await createClass({ courseId, period, sectionLabel, pic })
      setMsg(`Created section ${sectionLabel}`); setSectionLabel('')
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="class-h" className="feu-card">
      <h2 id="class-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>New Class (Section)</h2>
      <label className="feu-label" htmlFor="cl-course">Course</label>
      <select id="cl-course" className="feu-input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
      </select>
      <label className="feu-label" htmlFor="cl-period">Period</label>
      <select id="cl-period" className="feu-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
        {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <label className="feu-label" htmlFor="cl-section">Section Label</label>
      <input id="cl-section" className="feu-input" value={sectionLabel} onChange={(e) => setSectionLabel(e.target.value)} placeholder="6A" />
      <label className="feu-label" htmlFor="cl-pic">PIC</label>
      <input id="cl-pic" className="feu-input" list="pic-options" value={pic} onChange={(e) => setPic(e.target.value)} placeholder="Person in charge" />
      <datalist id="pic-options">{pics.map((p) => <option key={p} value={p} />)}</datalist>
      <div style={{ marginTop: 12 }}>
        <button type="button" className="feu-btn-green" onClick={onCreate} disabled={busy || !courseId || !sectionLabel.trim()}>
          {busy ? 'Creating…' : 'Create class'}
        </button>
      </div>
      {msg && <p role="status" className={msg.startsWith('Failed') ? 'feu-error' : 'feu-muted'} style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
