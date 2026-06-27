import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { course } = await searchParams
  const courseId = typeof course === 'string' ? course : undefined

  const classes = await listClasses()

  /* ── Course-level view (no ?course param) ───────────────────────────── */
  if (!courseId) {
    // Group classes by courseId
    const courseMap = new Map<
      string,
      { courseId: string; code: string; title: string; sectionCount: number }
    >()
    for (const c of classes) {
      if (!courseMap.has(c.courseId)) {
        courseMap.set(c.courseId, {
          courseId: c.courseId,
          code: c.code,
          title: c.title,
          sectionCount: 0,
        })
      }
      courseMap.get(c.courseId)!.sectionCount += 1
    }
    const courses = [...courseMap.values()]

    return (
      <div className="feu-page">
        <h1>Courses &amp; Classes</h1>
        <p className="feu-page-sub">
          Select a course to view its class sections.{' '}
          <Link href="/instructor/builder" style={{ color: 'var(--green)' }}>
            Create courses &amp; classes in Course Builder &rarr;
          </Link>
        </p>

        <section className="feu-card" aria-labelledby="courses-list-h">
          <h2 id="courses-list-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
            Your Courses
          </h2>
          {courses.length === 0 && (
            <p className="feu-muted">
              No courses yet —{' '}
              <Link href="/instructor/builder" style={{ color: 'var(--green)' }}>
                create one in Course Builder
              </Link>
              .
            </p>
          )}
          {courses.map((co) => (
            <Link
              key={co.courseId}
              href={`/instructor/classes?course=${co.courseId}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--line, #eee)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span>
                <span style={{ fontWeight: 600 }}>{co.code}</span>
                {co.title ? (
                  <span className="feu-muted" style={{ marginLeft: 8 }}>
                    {co.title}
                  </span>
                ) : null}
              </span>
              <span className="feu-muted" style={{ fontSize: 13 }}>
                {co.sectionCount} section{co.sectionCount !== 1 ? 's' : ''} &rarr;
              </span>
            </Link>
          ))}
        </section>
      </div>
    )
  }

  /* ── Section-level view (?course=X) ─────────────────────────────────── */
  const sections = classes.filter((c) => c.courseId === courseId)
  const courseInfo = sections[0] ?? classes.find((c) => c.courseId === courseId)
  const courseCode = courseInfo?.code ?? courseId
  const courseTitle = courseInfo?.title ?? ''

  return (
    <div className="feu-page">
      <p style={{ marginBottom: 8 }}>
        <Link href="/instructor/classes" style={{ color: 'var(--green)', fontSize: 13 }}>
          &larr; Back to Courses
        </Link>
      </p>

      <h1>
        {courseCode}
        {courseTitle ? <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 22 }}>{courseTitle}</span> : null}
      </h1>
      <p className="feu-page-sub">Class sections for this course.</p>

      <section className="feu-card" aria-labelledby="sections-list-h">
        <h2 id="sections-list-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
          Sections
        </h2>
        {sections.length === 0 && (
          <p className="feu-muted">No sections in this course yet.</p>
        )}
        {sections.map((c) => (
          <Link
            key={c.id}
            href={`/instructor/classes/${c.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid var(--line, #eee)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span style={{ fontWeight: 600 }}>{c.displayName}</span>
            <span className="feu-muted" style={{ fontSize: 13 }}>
              {c.period}
              {c.pic ? ` · ${c.pic}` : ''}
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
