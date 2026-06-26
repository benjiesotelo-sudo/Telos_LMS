import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/app/components/Sidebar'

const ITEMS = [
  { href: '/instructor', label: 'Dashboard' },
  { href: '/instructor/classes', label: 'Classes' },
  { href: '/instructor/roster', label: 'Roster & Links' },
  { href: '/instructor/assessments', label: 'Assessments' },
  { href: '/instructor/grades', label: 'Grades' },
  { href: '/instructor/profile', label: 'Profile' },
]

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  let label: string | undefined
  if (auth.user) {
    const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', auth.user.id).maybeSingle()
    label = p?.full_name || p?.email || undefined
  }
  return (
    <div className="feu-shell">
      <Sidebar title="Telos · Instructor" items={ITEMS} userLabel={label} />
      <main className="feu-main">{children}</main>
    </div>
  )
}
