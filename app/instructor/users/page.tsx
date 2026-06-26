import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listUsers } from '@/app/actions/admin/listUsers'
import { UsersPanel } from '@/app/instructor/UsersPanel'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="feu-page">
        <div className="feu-card" style={{ borderLeft: '4px solid var(--red, #c0392b)', marginTop: 24 }}>
          <h2 style={{ color: 'var(--red, #c0392b)', marginBottom: 8 }}>Forbidden</h2>
          <p className="feu-muted">You do not have permission to access this page. Admin role required.</p>
        </div>
      </div>
    )
  }

  const rows = await listUsers()

  return (
    <div className="feu-page">
      <h1>User Management</h1>
      <p className="feu-page-sub">Create, edit, reset passwords, and delete user accounts across the system.</p>
      <UsersPanel rows={rows} />
    </div>
  )
}
