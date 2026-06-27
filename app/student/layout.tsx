import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/app/components/Sidebar'

const ITEMS = [
  { href: '/student', label: 'Dashboard' },
  { href: '/student/todo', label: 'To-Do' },
  { href: '/student/grades', label: 'Grades' },
  { href: '/student/profile', label: 'Profile' },
]

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  let label: string | undefined
  if (auth.user) {
    const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', auth.user.id).maybeSingle()
    label = p?.full_name || p?.email || undefined
  }
  return (
    <div className="feu-shell">
      <Sidebar title="Telos · Student" items={ITEMS} userLabel={label} />
      <main className="feu-main">{children}</main>
    </div>
  )
}
