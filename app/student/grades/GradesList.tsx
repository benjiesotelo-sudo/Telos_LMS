'use client'
import { useState } from 'react'
import { SearchBox } from '@/app/components/SearchBox'
import { scoreColor, letterColor, typeTag, splitPeriods } from '@/app/instructor/grades/gradeStyles'
import type { StudentClassGrade } from '@/lib/types'

function pct(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}%` : '—'
}

function ClassGradeCard({ g }: { g: StudentClassGrade }) {
  const { midtermCols, finalCols } = splitPeriods(g.assessments)
  const rows = [
    { label: 'Midterm', cols: midtermCols, mark: g.midtermMark },
    { label: 'Final', cols: finalCols, mark: g.finalMark },
  ].filter((r) => r.cols.length > 0)

  return (
    <div className="feu-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, margin: 0, color: 'var(--green)' }}>{g.displayName}</h2>
        <span className="feu-muted" style={{ fontSize: 12 }}>
          Quizzes {Math.round(g.weights.wtQuiz * 100)}% · Papers/HW {Math.round(g.weights.wtPaper * 100)}% · Exam {Math.round(g.weights.wtExam * 100)}%
        </span>
      </div>

      {rows.map((r) => (
        <div key={r.label} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray)', margin: 0 }}>{r.label}</h3>
            <span style={{ fontSize: 13, fontWeight: 700, color: r.mark !== null ? scoreColor(r.mark) : 'var(--gray)' }}>
              Mark: {pct(r.mark)}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {r.cols.map((a) => {
              const v = g.cells[a.assessmentId] ?? null
              const manual = g.rawOverrides[a.assessmentId] !== undefined
              return (
                <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', minWidth: 110, background: manual ? '#fffbe6' : '#fff' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray)' }}>
                    [{typeTag(a.type)}] {a.title}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: v !== null ? scoreColor(v) : 'var(--gray)' }}>
                    {pct(v)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14 }}>
          <strong>Course Mark:</strong>{' '}
          <span style={{ fontWeight: 700, color: g.courseMark !== null ? scoreColor(g.courseMark) : 'var(--gray)' }}>
            {g.courseMark !== null ? `${g.courseMark.toFixed(2)}%` : '—'}
          </span>
        </span>
        <span style={{ fontSize: 14 }}>
          <strong>Grade:</strong>{' '}
          <span style={{ fontWeight: 700, color: letterColor(g.letter) }}>
            {g.letter ?? '—'}{g.qp !== null ? ` (${g.qp.toFixed(1)})` : ''}
          </span>
        </span>
      </div>
    </div>
  )
}

export function GradesList({ classes }: { classes: StudentClassGrade[] }) {
  const [query, setQuery] = useState('')

  if (classes.length === 0) {
    return <p className="feu-muted">No grades yet.</p>
  }

  const q = query.trim().toLowerCase()
  const matches = (g: StudentClassGrade) =>
    q === '' || (g.displayName ?? '').toLowerCase().includes(q)

  const filtered = classes.filter(matches)
  const noMatches = q !== '' && filtered.length === 0

  return (
    <>
      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder="Search grades by class…"
        ariaLabel="Search grades"
      />
      {noMatches && <p className="feu-muted">No grades match &ldquo;{query}&rdquo;.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {filtered.map((g) => (
          <ClassGradeCard key={g.classId} g={g} />
        ))}
      </div>
    </>
  )
}
