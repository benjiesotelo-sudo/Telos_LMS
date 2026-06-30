'use client'

import { useState } from 'react'
import { submitPasswordResetRequest } from '@/app/actions/passwordResetRequests'
import { PasswordInput } from '@/app/components/PasswordInput'

/**
 * Student-facing password recovery: choose a new password, which an instructor approves.
 * No email involved. Auto-opens after a failed sign-in (defaultOpen).
 */
export function RequestResetPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [email, setEmail] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [msg, setMsg] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    if (pw.length < 6) {
      setMsg('New password must be at least 6 characters.')
      return
    }
    if (pw !== confirm) {
      setMsg('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await submitPasswordResetRequest({ email, studentNumber, newPassword: pw })
      setSent(true)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          type="button"
          className="feu-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={() => setOpen(true)}
        >
          Can&rsquo;t sign in? Request a password reset
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="feu-card">
        <h2 style={{ fontSize: 15, marginBottom: 6, color: 'var(--green)' }}>
          Request a password reset
        </h2>
        {sent ? (
          <p>
            If your email and student number match an account, your instructor will review your
            request. You can sign in with your new password once it&rsquo;s approved.
          </p>
        ) : (
          <>
            <p className="feu-muted" style={{ fontSize: 12, marginBottom: 12 }}>
              Choose a new password below. Your instructor approves the request, then you can sign
              in with it &mdash; no email needed.
            </p>
            <form onSubmit={onSubmit}>
              <label className="feu-label" htmlFor="rr-email">Email</label>
              <input
                id="rr-email"
                className="feu-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label className="feu-label" htmlFor="rr-sn" style={{ marginTop: 10 }}>Student number</label>
              <input
                id="rr-sn"
                className="feu-input"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                required
              />

              <label className="feu-label" htmlFor="rr-pw" style={{ marginTop: 10 }}>New password</label>
              <PasswordInput
                id="rr-pw"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />

              <label className="feu-label" htmlFor="rr-pw2" style={{ marginTop: 10 }}>Confirm new password</label>
              {/* Always masked — retype it from memory so you know you've got it right. */}
              <input
                id="rr-pw2"
                className="feu-input"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />

              {msg && <p className="feu-error" style={{ marginTop: 10 }}>{msg}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button type="submit" className="feu-btn-gold" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit request'}
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--feu-green)' }}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
