'use client'
import { useState } from 'react'
import { enrollStudent } from '@/app/actions/enrollStudent'

export function EnrollPanel({ courseId, periodId }: { courseId: string; periodId: string }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function onEnroll() {
    setBusy(true)
    setMsg('')
    setInviteUrl('')
    try {
      const res = await enrollStudent({
        courseId,
        periodId,
        email,
        fullName,
        studentNumber: studentNumber.trim() || undefined,
      })
      setInviteUrl(res.inviteUrl)
      setEmail('')
      setFullName('')
      setStudentNumber('')
    } catch (e) {
      setMsg(`Enroll failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="enroll-h" className="feu-card">
      <h2 id="enroll-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
        Enroll Student
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="feu-label" htmlFor="enroll-email">Student Email</label>
          <input
            id="enroll-email"
            aria-label="Student email"
            className="feu-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
          />
        </div>
        <div>
          <label className="feu-label" htmlFor="enroll-name">Full Name</label>
          <input
            id="enroll-name"
            aria-label="Full name"
            className="feu-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="feu-label" htmlFor="enroll-sn">Student Number (optional)</label>
          <input
            id="enroll-sn"
            aria-label="Student number"
            className="feu-input"
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value)}
            placeholder="Student number (optional)"
          />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className="feu-btn-green"
          onClick={onEnroll}
          disabled={busy || !email.trim()}
        >
          {busy ? 'Creating invite...' : 'Create invite link'}
        </button>
      </div>
      {inviteUrl && (
        <div style={{ marginTop: 14 }}>
          <label className="feu-label" htmlFor="invite-link">Invite Link</label>
          <input
            id="invite-link"
            aria-label="Invite link"
            className="feu-input"
            readOnly
            value={inviteUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}
      {msg && (
        <p role="status" className="feu-error" style={{ marginTop: 10 }}>
          {msg}
        </p>
      )}
    </section>
  )
}
