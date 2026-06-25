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
    <section aria-labelledby="enroll-h">
      <h2 id="enroll-h">Enroll student</h2>
      <input aria-label="Student email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" />
      <input aria-label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
      <input aria-label="Student number" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="Student number (optional)" />
      <button type="button" onClick={onEnroll} disabled={busy || !email.trim()}>
        {busy ? 'Creating invite...' : 'Create invite link'}
      </button>
      {inviteUrl && (
        <p>
          Invite link: <input aria-label="Invite link" readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
        </p>
      )}
      {msg && <p role="status">{msg}</p>}
    </section>
  )
}
