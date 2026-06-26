'use client'
import { useState } from 'react'
import { registerViaLink } from '@/app/actions/registerViaLink'

export function RegisterForm({ token, kind, sections }: {
  token: string; kind: 'class' | 'general'; sections: { id: string; displayName: string }[]
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [password, setPassword] = useState('')
  const [classId, setClassId] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit() {
    setBusy(true); setMsg('')
    try {
      await registerViaLink({ token, fullName, email, password, studentNumber, classId: classId || undefined })
      setDone(true)
    } catch (e) {
      setMsg(`${e instanceof Error ? e.message : String(e)}`)
    } finally { setBusy(false) }
  }

  if (done) return <div className="feu-card"><p className="feu-muted">Registration submitted. Your instructor will approve your account — you can log in once approved.</p></div>

  return (
    <section className="feu-card">
      <label className="feu-label" htmlFor="r-name">Full Name</label>
      <input id="r-name" className="feu-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <label className="feu-label" htmlFor="r-sn">Student Number</label>
      <input id="r-sn" className="feu-input" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
      <label className="feu-label" htmlFor="r-email">Email</label>
      <input id="r-email" className="feu-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="feu-label" htmlFor="r-pw">Password</label>
      <input id="r-pw" className="feu-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {kind === 'general' && (
        <>
          <label className="feu-label" htmlFor="r-sec">Section (optional)</label>
          <select id="r-sec" className="feu-input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— pick later —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
          </select>
        </>
      )}
      <div style={{ marginTop: 14 }}>
        <button type="button" className="feu-btn-green" onClick={onSubmit}
          disabled={busy || !fullName.trim() || !email.trim() || !password || !studentNumber.trim()}>
          {busy ? 'Submitting…' : 'Register'}
        </button>
      </div>
      {msg && <p role="status" className="feu-error" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  )
}
