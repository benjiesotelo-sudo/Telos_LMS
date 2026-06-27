'use client'
import { useState } from 'react'
import { acceptInvite, declineInvite } from '@/app/actions/invites'
import type { ClassInvite } from '@/app/actions/invites'

export function InvitesPanel({ invites }: { invites: ClassInvite[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (invites.length === 0) return null

  async function act(classId: string, kind: 'accept' | 'decline') {
    setBusy(`${classId}:${kind}`)
    setError(null)
    try {
      if (kind === 'accept') await acceptInvite({ classId })
      else await declineInvite({ classId })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.')
      setBusy(null)
    }
  }

  return (
    <div className="feu-card" style={{ marginBottom: 20, borderColor: 'var(--gold)', background: '#fffdf5' }}>
      <h2 style={{ fontSize: 16, margin: '0 0 10px', color: 'var(--gold-dk)' }}>
        Class invites ({invites.length})
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {invites.map((inv) => {
          const busyAccept = busy === `${inv.classId}:accept`
          const busyDecline = busy === `${inv.classId}:decline`
          const anyBusy = busyAccept || busyDecline
          return (
            <div
              key={inv.classId}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{inv.code} - {inv.sectionLabel}</div>
                <div className="feu-muted" style={{ fontSize: 12 }}>
                  {inv.title}{inv.period ? ` · ${inv.period}` : ''}{inv.invitedByName ? ` · invited by ${inv.invitedByName}` : ''}
                </div>
              </div>
              <button type="button" className="feu-btn-gold" disabled={anyBusy} onClick={() => act(inv.classId, 'accept')}>
                {busyAccept ? 'Joining…' : 'Accept'}
              </button>
              <button type="button" className="feu-btn-outline" disabled={anyBusy} onClick={() => act(inv.classId, 'decline')}>
                {busyDecline ? 'Declining…' : 'Decline'}
              </button>
            </div>
          )
        })}
      </div>
      {error && <p className="feu-error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  )
}
