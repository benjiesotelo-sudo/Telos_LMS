'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SearchBox } from '@/app/components/SearchBox'

interface SectionItem {
  id: string
  displayName: string
  period: string
  pic: string
}

export function SectionList({ sections }: { sections: SectionItem[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = (c: SectionItem) =>
    q === '' || [c.displayName, c.period, c.pic].some((v) => (v ?? '').toLowerCase().includes(q))

  const filtered = sections.filter(matches)
  const noMatches = sections.length > 0 && q !== '' && filtered.length === 0

  return (
    <>
      {sections.length === 0 && (
        <p className="feu-muted">No sections in this course yet.</p>
      )}
      {sections.length > 0 && (
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search sections…"
          ariaLabel="Search sections"
        />
      )}
      {noMatches && <p className="feu-muted">No sections match &ldquo;{query}&rdquo;.</p>}
      {filtered.map((c) => (
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
    </>
  )
}
