'use client'

import { useState } from 'react'
import { requestPasswordReset } from '@/app/actions/requestPasswordReset'

export function ForgotPasswordForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setBusy(true)
    try {
      await requestPasswordReset({ email })
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
          Forgot password?
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="feu-card">
        <h2 style={{ fontSize: 15, marginBottom: 12, color: 'var(--green)' }}>
          Reset Password
        </h2>
        {sent ? (
          <p>If that email exists, a reset link was sent.</p>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label className="feu-label" htmlFor="fp-email">Email</label>
              <input
                id="fp-email"
                className="feu-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {msg && <p className="feu-error">{msg}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="feu-btn-gold" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
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
        )}
      </div>
    </div>
  )
}
