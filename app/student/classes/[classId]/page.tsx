import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentClassDetail } from '@/app/actions/getStudentData'
import { GroupedTaskList, TaskList } from '../../TaskList'

export default async function StudentClassDetail({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { classId } = await params
  const detail = await getStudentClassDetail({ classId })

  if (!detail) {
    return (
      <div className="feu-page">
        <Link href="/student" className="feu-muted" style={{ fontSize: 13 }}>← Dashboard</Link>
        <h1>Class not found</h1>
        <p className="feu-muted">You may not be enrolled in this class.</p>
      </div>
    )
  }

  const now = Date.now()
  const todo = detail.tasks.filter(
    (t) =>
      t.active &&
      !t.isManual &&
      !t.submitted &&
      (!t.opensAt || new Date(t.opensAt).getTime() <= now) &&
      (!t.closesAt || new Date(t.closesAt).getTime() > now),
  )

  return (
    <div className="feu-page">
      <Link href="/student" className="feu-muted" style={{ fontSize: 13 }}>← Dashboard</Link>
      <h1>{detail.code} - {detail.sectionLabel}</h1>
      <p className="feu-page-sub">{detail.title}{detail.period ? ` · ${detail.period}` : ''}</p>

      {todo.length > 0 && (
        <div className="feu-card" style={{ marginBottom: 18, background: '#fffdf5' }}>
          <h2 style={{ fontSize: 15, margin: '0 0 10px', color: 'var(--gold-dk)' }}>To do in this class</h2>
          <TaskList tasks={todo} />
        </div>
      )}

      <div className="feu-card">
        <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>All tasks</h2>
        {detail.tasks.length === 0 ? (
          <p className="feu-muted">No assessments assigned yet.</p>
        ) : (
          <GroupedTaskList tasks={detail.tasks} />
        )}
      </div>
    </div>
  )
}
