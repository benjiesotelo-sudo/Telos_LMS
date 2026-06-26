import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function StudentClassesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('class_id, classes:class_id(period, section_label, courses:course_id(code, title))')

  type EnrolledClass = {
    class_id: string
    classes: {
      period: string | null
      section_label: string | null
      courses: { code: string; title: string } | null
    } | null
  }

  const rows = (enrollments ?? []) as unknown as EnrolledClass[]

  return (
    <div className="feu-page">
      <h1>My Classes</h1>
      <p className="feu-page-sub">Classes you are currently enrolled in.</p>

      {rows.length === 0 ? (
        <p className="feu-muted">You are not enrolled in any classes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.map((e) => {
            const cls = e.classes
            const course = cls?.courses
            return (
              <div key={e.class_id} className="feu-card">
                <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>
                  {course?.code ?? '—'} – {cls?.section_label ?? '—'}
                </h2>
                <p style={{ margin: '0 0 4px', fontWeight: 500 }}>{course?.title ?? ''}</p>
                {cls?.period && (
                  <p className="feu-muted" style={{ margin: 0, fontSize: 13 }}>Period: {cls.period}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
