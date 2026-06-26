import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role, student_number')
    .eq('id', auth.user.id)
    .maybeSingle()

  return (
    <div className="feu-page">
      <h1>Profile</h1>
      <p className="feu-page-sub">Your account details.</p>

      <section className="feu-card" aria-labelledby="profile-h">
        <h2 id="profile-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Account</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="feu-label" style={{ width: 140, flexShrink: 0 }}>Full name</span>
            <span>{profile?.full_name ?? <span className="feu-muted">—</span>}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="feu-label" style={{ width: 140, flexShrink: 0 }}>Email</span>
            <span>{profile?.email ?? auth.user.email ?? <span className="feu-muted">—</span>}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="feu-label" style={{ width: 140, flexShrink: 0 }}>Role</span>
            <span style={{ textTransform: 'capitalize' }}>{profile?.role ?? <span className="feu-muted">—</span>}</span>
          </div>
          {profile?.student_number && (
            <div style={{ display: 'flex', gap: 12 }}>
              <span className="feu-label" style={{ width: 140, flexShrink: 0 }}>Student number</span>
              <span>{profile.student_number}</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <form action={signOut}>
            <button type="submit" className="feu-btn-gold">Sign out</button>
          </form>
        </div>
      </section>
    </div>
  )
}
