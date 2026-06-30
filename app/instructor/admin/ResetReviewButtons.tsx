'use client'
import { useState } from 'react'
import { approvePasswordReset, rejectPasswordReset } from '@/app/actions/passwordResetRequests'

export function ResetReviewButtons({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(kind: 'approve' | 'reject') {
    if (
      kind === 'approve' &&
      !window.confirm(
        'Approve this reset? The student’s password will be changed to the one they chose, and their account activated.',
      )
    )
      return
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'approve') await approvePasswordReset({ requestId })
      else await rejectPasswordReset({ requestId })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        className="feu-btn-gold"
        disabled={busy !== null}
        onClick={() => act('approve')}
        style={{ fontSize: 12, padding: '4px 12px' }}
      >
        {busy === 'approve' ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        className="feu-btn-outline"
        disabled={busy !== null}
        onClick={() => act('reject')}
        style={{ fontSize: 12, padding: '4px 12px' }}
      >
        {busy === 'reject' ? 'Rejecting…' : 'Reject'}
      </button>
      {error && <span className="feu-error" style={{ fontSize: 12 }}>{error}</span>}
    </div>
  )
}
