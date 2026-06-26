'use client'

import { useState } from 'react'
import { updatePassword } from '@/app/actions/updatePassword'

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setSaved(false)
    if (newPassword !== confirm) {
      setMsg('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await updatePassword({ newPassword })
      setSaved(true)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="feu-card" aria-label="Change password">
      <h2 style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
        Change Password
      </h2>
      {saved ? (
        <p style={{ color: 'var(--green)' }}>Password updated successfully.</p>
      ) : (
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label className="feu-label" htmlFor="new-pw">New password</label>
            <input
              id="new-pw"
              className="feu-input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="feu-label" htmlFor="confirm-pw">Confirm new password</label>
            <input
              id="confirm-pw"
              className="feu-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {msg && <p className="feu-error">{msg}</p>}
          <button
            type="submit"
            className="feu-btn-gold"
            style={{ marginTop: 8 }}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
    </section>
  )
}
