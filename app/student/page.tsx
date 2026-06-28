import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentTodo, getStudentDone } from '@/app/actions/getStudentData'
import { getMyInvites } from '@/app/actions/invites'
import { TaskList } from './TaskList'
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

      <div className="feu-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 4px', color: 'var(--gold-dk)' }}>
          To-Do {todo.length > 0 && <span className="feu-muted" style={{ fontSize: 13, fontWeight: 400 }}>({todo.length})</span>}
        </h2>
        <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Open across all your classes, soonest deadline first.</p>
        {todo.length === 0 ? <p className="feu-muted">You&apos;re all caught up. 🎉</p> : <TaskList tasks={todo} />}
      </div>

      <div className="feu-card">
        <h2 style={{ fontSize: 16, margin: '0 0 4px', color: 'var(--green)' }}>
          Done {done.length > 0 && <span className="feu-muted" style={{ fontSize: 13, fontWeight: 400 }}>({done.length})</span>}
        </h2>
        <p className="feu-muted" style={{ fontSize: 12, margin: '0 0 12px' }}>Most recently finished first.</p>
        {done.length === 0 ? <p className="feu-muted">Nothing submitted yet.</p> : <TaskList tasks={done} />}
      </div>
    </div>
  )
}
