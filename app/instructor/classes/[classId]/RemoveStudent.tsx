'use client'
import { useState } from 'react'
import { requestStudentRemoval } from '@/app/actions/removalRequests'

export function RemoveStudent({
  classId,
  studentId,
  studentName,
  pending,
}: {
  classId: string
  studentId: string
  studentName: string
  pending: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [requested, setRequested] = useState(pending)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    const reason = window.prompt(
      `Reason for removing ${studentName}? This is sent to an admin to approve.`,
    )
    if (reason == null) return
    if (reason.trim().length < 3) {
      setError('A reason is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await requestStudentRemoval({ classId, studentId, reason })
      setRequested(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed.')
    } finally {
      setBusy(false)
    }
  }

  if (requested) {
    return <span style={{ fontSize: 12, color: 'var(--gold-dk)', fontWeight: 600 }}>Removal pending</span>
  }
  return (
    <span>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{ fontSize: 12, padding: '3px 10px', background: '#fff', color: '#c0392b', border: '1px solid #c0392b', borderRadius: 4, cursor: 'pointer' }}
      >
        {busy ? '…' : 'Request removal'}
      </button>
      {error && <span className="feu-error" style={{ fontSize: 11, marginLeft: 6 }}>{error}</span>}
    </span>
  )
}
