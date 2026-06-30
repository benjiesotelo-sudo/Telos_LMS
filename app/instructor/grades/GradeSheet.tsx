'use client'
import { useState } from 'react'
import type { SectionGrades, SectionAssessmentMeta } from '@/lib/types'
import { scoreColor, letterColor, typeTag, typeBg, splitPeriods, MANUAL_TINT } from './gradeStyles'
import { SearchBox } from '@/app/components/SearchBox'

// One read-only assessment cell. `isManual` → amber tint + dot.
function ReadCell({
  pct,
  isManual,
  autoPct,
}: {
  pct: number | null
  isManual: boolean
  autoPct: number | null
}) {
  if (pct === null) {
    return (
      <td style={tdStyle}>
        <span style={{ color: 'var(--gray)' }}>—</span>
      </td>
    )
  }
  const title = isManual
    ? autoPct !== null
      ? `Manually entered (auto: ${autoPct.toFixed(1)}%)`
      : 'Manually entered (no auto-grade)'
    : undefined
  return (
    <td style={{ ...tdStyle, background: isManual ? MANUAL_TINT : undefined }} title={title}>
      {isManual && <span style={{ color: 'var(--gold-dk)', marginRight: 3 }}>•</span>}
      <span style={{ color: scoreColor(pct), fontWeight: 500 }}>{pct.toFixed(1)}%</span>
    </td>
  )
}

function csvEscape(x: string | number): string {
  const s = String(x)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCsv(grades: SectionGrades) {
  const { midtermCols, finalCols } = splitPeriods(grades.assessments)
  const cols = [...midtermCols, ...finalCols]
  const header = [
    'Name',
    'Student #',
    ...cols.map((c) => `${c.title} (%)`),
    'Midterm',
    'Final',
    'Course Mark',
    'Letter',
    'QP',
  ]
  const rows = grades.students.map((s) => [
    s.fullName,
    s.studentNumber ?? '',
    ...cols.map((c) => {
      const v = s.cells[c.assessmentId]
      return v == null ? '' : v.toFixed(2)
    }),
    s.midtermMark != null ? s.midtermMark.toFixed(2) : '',
    s.finalMark != null ? s.finalMark.toFixed(2) : '',
    s.courseMark != null ? s.courseMark.toFixed(2) : '',
    s.letter ?? '',
    s.qp != null ? String(s.qp) : '',
  ])
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${grades.class.displayName.replace(/[^\w.-]+/g, '_')}-grades.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function GradeSheet({ grades }: { grades: SectionGrades }) {
  const { class: cls, assessments, students } = grades
  const { midtermCols, finalCols } = splitPeriods(assessments)
  const mSpan = midtermCols.length + 1
  const fSpan = finalCols.length + 1
  const { wtQuiz, wtPaper, wtExam } = cls.weights

  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = (s: SectionGrades['students'][number]) =>
    q === '' || [s.fullName, s.studentNumber].some((v) => (v ?? '').toLowerCase().includes(q))
  const visible = students.filter(matches)

  function colHeader(a: SectionAssessmentMeta, isFirst: boolean) {
    return (
      <th
        key={a.id}
        title={a.graded ? a.title : `${a.title} — ungraded (not counted in marks)`}
        style={{
          ...thBase,
          background: typeBg(a.type),
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderLeft: isFirst ? '2px solid var(--green)' : undefined,
          opacity: a.graded ? 1 : 0.6,
        }}
      >
        <span style={{ color: 'var(--gray)', marginRight: 2 }}>[{typeTag(a.type)}]</span>
        {a.title}
        {!a.graded && <span style={{ display: 'block', fontSize: 9, color: 'var(--gray)', fontWeight: 400 }}>ungraded</span>}
      </th>
    )
  }

  const markCell = (v: number | null) => (v !== null ? `${v.toFixed(2)}%` : '—')

  const autoPctFor = (stu: SectionGrades['students'][number], a: SectionAssessmentMeta) =>
    stu.autoRaw[a.assessmentId] !== undefined && a.totalPoints > 0
      ? (stu.autoRaw[a.assessmentId] / a.totalPoints) * 100
      : null

  return (
    <div className="feu-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, color: 'var(--green)', margin: 0 }}>Grade Sheet</h2>
        <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{cls.displayName}</span>
        <span style={{ fontSize: 12, color: 'var(--gray)' }}>
          {students.length} student{students.length !== 1 ? 's' : ''}
        </span>
        {students.length > 0 && assessments.length > 0 && (
          <button
            type="button"
            onClick={() => exportCsv(grades)}
            className="feu-btn-outline"
            style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 12px' }}
          >
            Export CSV
          </button>
        )}
      </div>

      {students.length > 0 && assessments.length > 0 && (
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search students by name or student #…"
          ariaLabel="Search students"
        />
      )}

      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 14,
          padding: '7px 12px',
          background: '#f1f7f3',
          borderRadius: 5,
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--gray)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--ink)' }}>Grade weights:</strong>&nbsp; Quizzes&nbsp;
          {Math.round(wtQuiz * 100)}%&nbsp;·&nbsp;Papers/HW&nbsp;{Math.round(wtPaper * 100)}%&nbsp;·&nbsp;Exam&nbsp;{Math.round(wtExam * 100)}%
        </span>
        <span>[Q]&nbsp;Quiz&nbsp;·&nbsp;[H]&nbsp;Homework&nbsp;·&nbsp;[P]&nbsp;Activity&nbsp;·&nbsp;[E]&nbsp;Exam</span>
        <span>
          <span style={{ color: 'var(--gold-dk)' }}>•</span>&nbsp;amber&nbsp;=&nbsp;manually edited grade. Edit grades in the Grade Editor below.
        </span>
      </div>

      {students.length === 0 && <p className="feu-muted">No students enrolled in this section.</p>}
      {students.length > 0 && assessments.length === 0 && (
        <p className="feu-muted">
          No assessments assigned yet. Add assessments from the class detail page.
        </p>
      )}

      {students.length > 0 && assessments.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', minWidth: '100%' }}
          >
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 140 }}>
                  Name
                </th>
                <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 90 }}>
                  Student&nbsp;#
                </th>
                <th colSpan={mSpan} style={{ ...groupTh, background: '#c4e8d4', borderLeft: '2px solid var(--green)' }}>
                  MIDTERM
                </th>
                <th colSpan={fSpan} style={{ ...groupTh, background: '#c4e8d4', borderLeft: '2px solid var(--green)' }}>
                  FINAL
                </th>
                <th colSpan={2} style={{ ...groupTh, background: '#ffe99a', borderLeft: '2px solid var(--gold)' }}>
                  COURSE GRADE
                </th>
              </tr>
              <tr>
                {midtermCols.map((a, i) => colHeader(a, i === 0))}
                <th style={{ ...thBase, background: '#a8d8bc', fontWeight: 700, borderLeft: '1px solid #7bbfa0', textAlign: 'center', minWidth: 56 }}>
                  MG
                </th>
                {finalCols.map((a, i) => colHeader(a, i === 0))}
                <th style={{ ...thBase, background: '#a8d8bc', fontWeight: 700, borderLeft: '1px solid #7bbfa0', textAlign: 'center', minWidth: 56 }}>
                  FG
                </th>
                <th style={{ ...thBase, background: '#fcd34d', fontWeight: 700, borderLeft: '2px solid var(--gold)', textAlign: 'center', minWidth: 66 }}>
                  MARK
                </th>
                <th style={{ ...thBase, background: '#fcd34d', fontWeight: 700, textAlign: 'center', minWidth: 48 }}>
                  LG
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={mSpan + fSpan + 4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--gray)' }}>
                    No students match &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
              {visible.map((stu, i) => {
                const rowBg = i % 2 === 0 ? '#fff' : '#f8fbf9'
                return (
                  <tr key={stu.studentId} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 500,
                        textAlign: 'left',
                        position: 'sticky',
                        left: 0,
                        background: rowBg,
                        zIndex: 1,
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      {stu.fullName || <span className="feu-muted">—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--gray)', borderRight: '1px solid var(--border)' }}>
                      {stu.studentNumber ?? '—'}
                    </td>
                    {midtermCols.map((a) => (
                      <ReadCell
                        key={a.id}
                        pct={stu.cells[a.assessmentId] ?? null}
                        isManual={stu.rawOverrides[a.assessmentId] !== undefined}
                        autoPct={autoPctFor(stu, a)}
                      />
                    ))}
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: stu.midtermMark !== null ? scoreColor(stu.midtermMark) : 'var(--gray)' }}>
                      {markCell(stu.midtermMark)}
                    </td>
                    {finalCols.map((a) => (
                      <ReadCell
                        key={a.id}
                        pct={stu.cells[a.assessmentId] ?? null}
                        isManual={stu.rawOverrides[a.assessmentId] !== undefined}
                        autoPct={autoPctFor(stu, a)}
                      />
                    ))}
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: stu.finalMark !== null ? scoreColor(stu.finalMark) : 'var(--gray)' }}>
                      {markCell(stu.finalMark)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', borderLeft: '2px solid var(--gold)', textAlign: 'center', color: stu.courseMark !== null ? scoreColor(stu.courseMark) : 'var(--gray)' }}>
                      {markCell(stu.courseMark)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', textAlign: 'center', color: letterColor(stu.letter) }}>
                      {stu.letter ?? '—'}
                      {stu.qp !== null && (
                        <span style={{ fontSize: 10, color: 'var(--gray)', marginLeft: 3 }}>({stu.qp.toFixed(1)})</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const thBase: React.CSSProperties = {
  padding: '6px 10px',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  color: '#3c5a48',
  borderBottom: '2px solid var(--border)',
  background: '#f1f7f3',
  verticalAlign: 'bottom',
}
const groupTh: React.CSSProperties = {
  textAlign: 'center',
  padding: '5px 10px',
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: '#3c5a48',
  borderBottom: '1px solid var(--border)',
}
const tdStyle: React.CSSProperties = { padding: '7px 10px', color: 'var(--ink)', textAlign: 'right' }
