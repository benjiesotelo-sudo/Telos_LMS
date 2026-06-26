'use client'
import { useState } from 'react'
import { createCourse } from '@/app/actions/createCourse'

export function CoursePanel() {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onCreate() {
    setBusy(true); setMsg('')
    try {
      await createCourse({ code, title, description })
      setMsg(`Created ${code}`); setCode(''); setTitle(''); setDescription('')
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="course-h" className="feu-card">
      <h2 id="course-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>New Course</h2>
      <label className="feu-label" htmlFor="c-code">Course Code</label>
      <input id="c-code" className="feu-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AMS0011" />
      <label className="feu-label" htmlFor="c-title">Title</label>
      <input id="c-title" className="feu-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Algebra and Trigonometry" />
      <label className="feu-label" htmlFor="c-desc">Description</label>
      <textarea id="c-desc" className="feu-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      <div style={{ marginTop: 12 }}>
        <button type="button" className="feu-btn-gold" onClick={onCreate} disabled={busy || !code.trim() || !title.trim()}>
          {busy ? 'Creating…' : 'Create course'}
        </button>
      </div>
      {msg && <p role="status" className={msg.startsWith('Failed') ? 'feu-error' : 'feu-muted'} style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
