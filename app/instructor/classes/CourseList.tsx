'use client'
import { useState } from 'react'
import Link from 'next/link'
import { SearchBox } from '@/app/components/SearchBox'

interface CourseItem {
  courseId: string
  code: string
  title: string
  sectionCount: number
}

export function CourseList({ courses }: { courses: CourseItem[] }) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = (co: CourseItem) =>
    q === '' || [co.code, co.title].some((v) => (v ?? '').toLowerCase().includes(q))

  const filtered = courses.filter(matches)
  const noMatches = courses.length > 0 && q !== '' && filtered.length === 0

  return (
    <>
      {courses.length === 0 && (
        <p className="feu-muted">
          No courses yet —{' '}
          <Link href="/instructor/builder" style={{ color: 'var(--green)' }}>
            create one in Course Builder
          </Link>
          .
        </p>
      )}
      {courses.length > 0 && (
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search courses by code or title…"
          ariaLabel="Search courses"
        />
      )}
      {noMatches && <p className="feu-muted">No courses match &ldquo;{query}&rdquo;.</p>}
      {filtered.map((co) => (
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
    </>
  )
}
