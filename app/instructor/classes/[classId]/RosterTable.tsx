'use client'
import { useState } from 'react'
import { SearchBox } from '@/app/components/SearchBox'
import { RemoveStudent } from './RemoveStudent'
import type { ClassDetailStudent } from '@/lib/types'

export function RosterTable({
  students,
  pendingRemovalIds,
  classId,
}: {
  students: ClassDetailStudent[]
  pendingRemovalIds: string[]
  classId: string
}) {
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const matches = (s: ClassDetailStudent) =>
    q === '' ||
    [s.fullName, s.studentNumber, s.email, s.status].some((v) => (v ?? '').toLowerCase().includes(q))

  const shown = students.filter(matches)
  const noMatches = students.length > 0 && q !== '' && shown.length === 0

  if (students.length === 0) {
    return <p className="feu-muted">No students enrolled yet.</p>
  }

  return (
    <>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search students by name, student #, email, or status…"
        ariaLabel="Search students"
      />
      {noMatches && <p className="feu-muted">No students match &ldquo;{query}&rdquo;.</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f1f7f3' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Student #</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Manage</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((stu) => (
              <tr key={stu.studentId} style={{ borderBottom: '1px solid var(--line, #eee)' }}>
                <td style={tdStyle}>{stu.fullName || <span className="feu-muted">—</span>}</td>
                <td style={tdStyle}>{stu.studentNumber ?? <span className="feu-muted">—</span>}</td>
                <td style={tdStyle}>{stu.email}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: stu.status === 'active' ? 'var(--green)' : 'var(--gray)',
                    }}
                  >
                    {stu.status}
                  </span>
                </td>
                <td style={tdStyle}>
                  <RemoveStudent
                    classId={classId}
                    studentId={stu.studentId}
                    studentName={stu.fullName || stu.email}
                    pending={pendingRemovalIds.includes(stu.studentId)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 10px',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#3c5a48',
  borderBottom: '1px solid var(--line, #eee)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  color: 'var(--ink)',
}
