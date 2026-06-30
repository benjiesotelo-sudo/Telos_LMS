'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SearchBox } from '@/app/components/SearchBox'
import { typeName } from '@/lib/assessmentType'
import type { AssessmentType } from '@/lib/types'

interface AssessmentItem { id: string; title: string; type: AssessmentType }

export function AssessmentsList({ assessments }: { assessments: AssessmentItem[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = (a: AssessmentItem) =>
    q === '' ||
    [a.title, typeName(a.type), a.type].some((v) => (v ?? '').toLowerCase().includes(q))

  const filtered = assessments.filter(matches)
  const noMatches = assessments.length > 0 && q !== '' && filtered.length === 0

  return (
    <>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search assessments by name or type…"
        ariaLabel="Search assessments"
      />
      {noMatches && <p className="feu-muted">No assessments match &ldquo;{query}&rdquo;.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {filtered.map((a) => (
          <Link
            key={a.id}
            href={`/instructor/assessments/${a.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '9px 0',
              borderBottom: '1px solid var(--line, #eee)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--gray)',
                  padding: '1px 6px',
                  border: '1px solid var(--line, #e2e8e4)',
                  borderRadius: 3,
                }}
              >
                {typeName(a.type)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--green)',
                  fontWeight: 500,
                }}
              >
                Preview / answers &rarr;
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
