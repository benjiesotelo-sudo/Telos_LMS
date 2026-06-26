import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses, listPics } from '@/app/actions/listClasses'
import { CoursePanel } from '@/app/instructor/CoursePanel'
import { ClassPanel } from '@/app/instructor/ClassPanel'

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: courses } = await supabase
    .from('courses')
    .select('id, code')
    .order('created_at')

  const [pics, classes] = await Promise.all([listPics(), listClasses()])

  return (
    <div className="feu-page">
      <h1>Classes</h1>
      <p className="feu-page-sub">Create courses and class sections.</p>

      <CoursePanel />
      <ClassPanel courses={courses ?? []} pics={pics} />

      <section className="feu-card" aria-labelledby="classes-list-h">
        <h2 id="classes-list-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
          Existing Classes
        </h2>
        {classes.length === 0 && <p className="feu-muted">No classes yet — create one above.</p>}
        {classes.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid var(--line, #eee)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{c.displayName}</span>
            <span className="feu-muted" style={{ fontSize: 13 }}>
              {c.period}{c.pic ? ` · ${c.pic}` : ''}
            </span>
          </div>
        ))}
      </section>
    </div>
  )
}
