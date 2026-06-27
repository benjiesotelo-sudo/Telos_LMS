import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentTodo } from '@/app/actions/getStudentData'
import { TaskList } from '../TaskList'

export default async function StudentTodoPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const items = await getStudentTodo()

  // Group the flat to-do list by class for readability.
  const byClass = new Map<string, { label: string; tasks: typeof items }>()
  for (const it of items) {
    const entry = byClass.get(it.classId) ?? { label: it.classLabel, tasks: [] as typeof items }
    entry.tasks.push(it)
    byClass.set(it.classId, entry)
  }

  return (
    <div className="feu-page">
      <h1>To-Do</h1>
      <p className="feu-page-sub">Everything still open across your classes, soonest first.</p>

      {items.length === 0 ? (
        <p className="feu-muted">You&apos;re all caught up. 🎉</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[...byClass.entries()].map(([classId, g]) => (
            <div key={classId} className="feu-card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontSize: 15, margin: 0, color: 'var(--green)' }}>{g.label}</h2>
                <Link href={`/student/classes/${classId}`} className="feu-muted" style={{ fontSize: 12 }}>
                  Open class →
                </Link>
              </div>
              <TaskList tasks={g.tasks} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
