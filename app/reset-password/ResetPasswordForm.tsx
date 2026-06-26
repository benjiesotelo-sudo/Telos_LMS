'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Status = 'loading' | 'ready' | 'invalid' | 'done'

export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>('loading')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Subscribe BEFORE anything else so we don't miss the PASSWORD_RECOVERY event.
    // createBrowserClient uses flowType: 'pkce' and detectSessionInUrl: true,
    // so it auto-exchanges the ?code= param from the recovery email link.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready')
      }
    })

    // If the singleton client already processed the code (e.g. the component
    // mounted after the exchange completed), fall back to checking the session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus((prev) => (prev === 'loading' ? 'ready' : prev))
      }
    })

    // After 5 s with no session/event, declare invalid/expired
    const timer = setTimeout(() => {
      setStatus((prev) => (prev === 'loading' ? 'invalid' : prev))
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    if (newPassword !== confirm) {
      setMsg('Passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setMsg('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setMsg(error.message)
      setBusy(false)
    } else {
      setStatus('done')
    }
  }

  if (status === 'loading') {
    return (
      <section className="feu-card">
        <p className="feu-muted">Verifying reset link…</p>
      </section>
    )
  }

  if (status === 'invalid') {
    return (
      <section className="feu-card">
        <p className="feu-error">This reset link is invalid or has expired.</p>
        <p style={{ marginTop: 12 }}>
          <a href="/login" className="feu-link">Back to sign in</a>
        </p>
      </section>
    )
  }

  if (status === 'done') {
    return (
      <section className="feu-card">
        <p style={{ color: 'var(--green)', marginBottom: 12 }}>
          Password updated — you can now log in.
        </p>
        <a
          href="/login"
          className="feu-btn-gold"
          style={{ textDecoration: 'none', display: 'inline-block' }}
        >
          Sign in
        </a>
      </section>
    )
  }

  return (
    <section className="feu-card" aria-label="Set new password">
      <h2 style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
        Set New Password
      </h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label className="feu-label" htmlFor="rp-new-pw">New password</label>
          <input
            id="rp-new-pw"
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
          <label className="feu-label" htmlFor="rp-confirm-pw">Confirm new password</label>
          <input
            id="rp-confirm-pw"
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
    </section>
  )
}
