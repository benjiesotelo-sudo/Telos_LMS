import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/app/components/Sidebar'

const BASE_ITEMS = [
  { href: '/instructor', label: 'Dashboard' },
  { href: '/instructor/classes', label: 'Courses & Classes' },
  { href: '/instructor/builder', label: 'Course Builder' },
  { href: '/instructor/enrollment', label: 'Enrollment' },
  { href: '/instructor/assessments', label: 'Assessments' },
  { href: '/instructor/grades', label: 'Grades' },
  { href: '/instructor/profile', label: 'Profile' },
]

const ADMIN_ITEMS = [
  { href: '/instructor/users', label: 'Users' },
]

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  let label: string | undefined
  let isAdmin = false
  if (auth.user) {
    const { data: p } = await supabase.from('profiles').select('full_name, email, role').eq('id', auth.user.id).maybeSingle()
    label = p?.full_name || p?.email || undefined
    isAdmin = p?.role === 'admin'
  }
  const items = isAdmin ? [...BASE_ITEMS, ...ADMIN_ITEMS] : BASE_ITEMS
  return (
    <div className="feu-shell">
      <Sidebar title="Telos · Instructor" items={items} userLabel={label} />
      <main className="feu-main">{children}</main>
    </div>
  )
}
