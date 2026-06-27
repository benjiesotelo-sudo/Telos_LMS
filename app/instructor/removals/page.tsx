import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listRemovalRequests } from '@/app/actions/removalRequests'
import { ReviewButtons } from './ReviewButtons'

export default async function RemovalsPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: p } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle()
  if (p?.role !== 'admin') redirect('/instructor')

  const requests = await listRemovalRequests()

  return (
    <div className="feu-page">
      <h1>Removal requests</h1>
      <p className="feu-page-sub">Instructors&apos; requests to remove a student from a class. Approve to remove; reject to keep.</p>

      {requests.length === 0 ? (
        <p className="feu-muted">No pending removal requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((r) => (
            <div key={r.id} className="feu-card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                <h2 style={{ fontSize: 16, margin: 0 }}>{r.studentName}</h2>
                <span className="feu-muted" style={{ fontSize: 12 }}>{r.studentNumber ?? '—'} · {r.classLabel}</span>
              </div>
              <p style={{ margin: '0 0 6px' }}>
                <strong>Reason:</strong> {r.reason}
              </p>
              <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
                Requested by {r.requestedByName ?? 'unknown'}
              </p>
              <ReviewButtons requestId={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
