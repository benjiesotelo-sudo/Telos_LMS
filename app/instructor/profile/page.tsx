import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import { ProfileForm } from '@/app/instructor/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('prefix, first_name, middle_initial, last_name, suffix, full_name, email, role, student_number')
    .eq('id', auth.user.id)
    .maybeSingle()

  return (
    <div className="feu-page">
      <h1>Profile</h1>
      <p className="feu-page-sub">Your account details.</p>

      <section className="feu-card" style={{ marginBottom: 16 }}>
        <h2 id="profile-acct-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>Account</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="feu-label" style={{ width: 140, flexShrink: 0 }}>Email</span>
            <span>{profile?.email ?? auth.user.email ?? <span className="feu-muted">—</span>}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="feu-label" style={{ width: 140, flexShrink: 0 }}>Role</span>
            <span style={{ textTransform: 'capitalize' }}>{profile?.role ?? <span className="feu-muted">—</span>}</span>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <form action={signOut}>
            <button type="submit" className="feu-btn-gold">Sign out</button>
          </form>
        </div>
      </section>

      <ProfileForm
        prefix={profile?.prefix}
        firstName={profile?.first_name ?? ''}
        middleInitial={profile?.middle_initial}
        lastName={profile?.last_name ?? ''}
        suffix={profile?.suffix}
        studentNumber={profile?.student_number}
        email={profile?.email ?? auth.user.email ?? ''}
        role={profile?.role ?? ''}
      />
    </div>
  )
}
