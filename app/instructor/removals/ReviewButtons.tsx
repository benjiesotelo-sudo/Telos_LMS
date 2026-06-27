'use client'
import { useState } from 'react'
import { approveRemoval, rejectRemoval } from '@/app/actions/removalRequests'

export function ReviewButtons({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(kind: 'approve' | 'reject') {
    if (kind === 'approve' && !window.confirm('Approve this removal? The student will be removed from the class.')) return
    setBusy(kind)
    setError(null)
    try {
      if (kind === 'approve') await approveRemoval({ requestId })
      else await rejectRemoval({ requestId })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button type="button" className="feu-btn-gold" disabled={busy !== null} onClick={() => act('approve')} style={{ fontSize: 12, padding: '4px 12px' }}>
        {busy === 'approve' ? 'Removing…' : 'Approve'}
      </button>
      <button type="button" className="feu-btn-outline" disabled={busy !== null} onClick={() => act('reject')} style={{ fontSize: 12, padding: '4px 12px' }}>
        {busy === 'reject' ? 'Rejecting…' : 'Reject'}
      </button>
      {error && <span className="feu-error" style={{ fontSize: 12 }}>{error}</span>}
    </div>
  )
}
