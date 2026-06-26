import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listClasses } from '@/app/actions/listClasses'

export default async function ClassesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const classes = await listClasses()

  return (
    <div className="feu-page">
      <h1>Classes</h1>
      <p className="feu-page-sub">
        Your active class sections.{' '}
        <Link href="/instructor/builder" style={{ color: 'var(--green)' }}>
          Create courses &amp; classes in Course Builder &rarr;
        </Link>
      </p>

      <section className="feu-card" aria-labelledby="classes-list-h">
        <h2 id="classes-list-h" style={{ fontSize: 16, marginBottom: 14, color: 'var(--green)' }}>
          Existing Classes
        </h2>
        {classes.length === 0 && (
          <p className="feu-muted">No classes yet — <Link href="/instructor/builder" style={{ color: 'var(--green)' }}>create one in Course Builder</Link>.</p>
        )}
        {classes.map((c) => (
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
              {c.period}{c.pic ? ` · ${c.pic}` : ''}
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
