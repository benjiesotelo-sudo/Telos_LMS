import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentTodo, getStudentDone } from '@/app/actions/getStudentData'
import { getMyInvites } from '@/app/actions/invites'
import { DashboardTabs } from './DashboardTabs'
import { InvitesPanel } from './InvitesPanel'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const [todo, done, invites] = await Promise.all([getStudentTodo(), getStudentDone(), getMyInvites()])

  return (
    <div className="feu-page">
      <h1>Dashboard</h1>
      <p className="feu-page-sub">What&apos;s due and what you&apos;ve finished.</p>

      <InvitesPanel invites={invites} />

      <DashboardTabs todo={todo} done={done} />
    </div>
  )
}
