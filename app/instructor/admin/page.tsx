import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listUsers } from '@/app/actions/admin/listUsers'
import { listRemovalRequests } from '@/app/actions/removalRequests'
import { UsersPanel } from '@/app/instructor/UsersPanel'
import { ReviewButtons } from '@/app/instructor/removals/ReviewButtons'

export default async function AdminControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  if (!profile || profile.role !== 'admin') {
    return (
      <div className="feu-page">
        <div className="feu-card" style={{ borderLeft: '4px solid #c0392b', marginTop: 24 }}>
          <h2 style={{ color: '#c0392b', marginBottom: 8 }}>Forbidden</h2>
          <p className="feu-muted">Admin role required.</p>
        </div>
      </div>
    )
  }

  const { tab: tabRaw } = await searchParams
  const tab = tabRaw === 'removals' ? 'removals' : 'users'

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: '6px 6px 0 0',
    border: '1px solid var(--border)',
    borderBottom: active ? '2px solid #fff' : '1px solid var(--border)',
    marginBottom: -1,
    background: active ? '#fff' : '#f1f7f3',
    color: active ? 'var(--green)' : 'var(--gray)',
    textDecoration: 'none',
  })

  return (
    <div className="feu-page">
      <h1>Admin Controls</h1>
      <p className="feu-page-sub">Manage user accounts and review student-removal requests.</p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
        <Link href="/instructor/admin?tab=users" style={tabStyle(tab === 'users')}>Users</Link>
        <Link href="/instructor/admin?tab=removals" style={tabStyle(tab === 'removals')}>Removal requests</Link>
      </div>

      {tab === 'users' ? <UsersTab /> : <RemovalsTab />}
    </div>
  )
}

async function UsersTab() {
  const rows = await listUsers()
  return (
    <div>
      <p className="feu-muted" style={{ marginBottom: 12 }}>Create, edit, reset passwords, and delete user accounts.</p>
      <UsersPanel rows={rows} />
    </div>
  )
}

async function RemovalsTab() {
  const requests = await listRemovalRequests()
  if (requests.length === 0) return <p className="feu-muted">No pending removal requests.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {requests.map((r) => (
        <div key={r.id} className="feu-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>{r.studentName}</h2>
            <span className="feu-muted" style={{ fontSize: 12 }}>{r.studentNumber ?? '—'} · {r.classLabel}</span>
          </div>
          <p style={{ margin: '0 0 6px' }}><strong>Reason:</strong> {r.reason}</p>
          <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Requested by {r.requestedByName ?? 'unknown'}</p>
          <ReviewButtons requestId={r.id} />
        </div>
      ))}
    </div>
  )
}
