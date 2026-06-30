'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SearchBox } from '@/app/components/SearchBox'
import type { StudentClassSummary } from '@/lib/types'

export function ClassesList({ classes }: { classes: StudentClassSummary[] }) {
  const [query, setQuery] = useState('')

  if (classes.length === 0) {
    return <p className="feu-muted">You are not enrolled in any classes yet.</p>
  }

  const q = query.trim().toLowerCase()
  const matches = (c: StudentClassSummary) =>
    q === '' ||
    [c.code, c.title, c.sectionLabel, c.period].some((v) => (v ?? '').toLowerCase().includes(q))

  const filtered = classes.filter(matches)
  const noMatches = q !== '' && filtered.length === 0

  return (
    <>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search classes by code, title, section, or period…"
        ariaLabel="Search classes"
      />
      {noMatches && <p className="feu-muted">No classes match &ldquo;{query}&rdquo;.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((c) => {
          const todo = c.tasks.filter((t) => !t.submitted && !t.isManual && t.active).length
          return (
            <Link
              key={c.classId}
              href={`/student/classes/${c.classId}`}
              className="feu-card"
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18, color: 'var(--green)' }}>{c.code} - {c.sectionLabel}</h2>
                <span className="feu-muted" style={{ fontSize: 13 }}>{c.title}</span>
              </div>
              <div className="feu-muted" style={{ fontSize: 12, marginTop: 4 }}>
                {c.period ? `${c.period} · ` : ''}{c.tasks.length} task{c.tasks.length !== 1 ? 's' : ''}{todo > 0 ? ` · ${todo} to do` : ''}
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}
