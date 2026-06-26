import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'
import { listPending } from '@/app/actions/listPending'

export default async function InstructorDashboard() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const [classes, pending] = await Promise.all([listClasses(), listPending()])

  return (
    <div className="feu-page">
      <h1>Dashboard</h1>
      <p className="feu-page-sub">Welcome back — here&rsquo;s a quick look at your instructor workspace.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
        <div className="feu-card">
          <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 6 }}>Classes</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)', margin: '0 0 12px' }}>{classes.length}</p>
          <Link href="/instructor/classes" style={{ fontSize: 13, color: 'var(--green)' }}>Manage classes &rarr;</Link>
        </div>

        <div className="feu-card">
          <p style={{ fontSize: 13, color: 'var(--gray)', marginBottom: 6 }}>Pending registrations</p>
          <p style={{ fontSize: 32, fontWeight: 700, color: pending.length > 0 ? 'var(--gold-dk)' : 'var(--green)', margin: '0 0 12px' }}>{pending.length}</p>
          <Link href="/instructor/roster" style={{ fontSize: 13, color: 'var(--green)' }}>Review roster &rarr;</Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 28 }}>
        <Link href="/instructor/assessments" className="feu-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <span style={{ fontWeight: 600 }}>Assessments</span>
          <span className="feu-muted" style={{ marginLeft: 12, fontSize: 13 }}>Import &amp; assign assessments to your classes</span>
        </Link>
        <Link href="/instructor/grades" className="feu-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <span style={{ fontWeight: 600 }}>Grades</span>
          <span className="feu-muted" style={{ marginLeft: 12, fontSize: 13 }}>View submissions and computed grades</span>
        </Link>
      </div>
    </div>
  )
}
