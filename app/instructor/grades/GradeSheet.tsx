'use client'
import type { SectionGrades, SectionAssessmentMeta } from '@/lib/types'
import { scoreColor, letterColor, typeTag, typeBg, splitPeriods, MANUAL_TINT } from './gradeStyles'

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

export function GradeSheet({ grades }: { grades: SectionGrades }) {
  const { class: cls, assessments, students } = grades
  const { midtermCols, finalCols } = splitPeriods(assessments)
  const mSpan = midtermCols.length + 1
  const fSpan = finalCols.length + 1
  const { wtQuiz, wtPaper, wtExam } = cls.weights

  function colHeader(a: SectionAssessmentMeta, isFirst: boolean) {
    return (
      <th
        key={a.id}
        title={a.title}
        style={{
          ...thBase,
          background: typeBg(a.type),
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderLeft: isFirst ? '2px solid var(--green)' : undefined,
        }}
      >
        <span style={{ color: 'var(--gray)', marginRight: 2 }}>[{typeTag(a.type)}]</span>
        {a.title}
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
      </div>

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
        <span>[Q]&nbsp;Quiz&nbsp;·&nbsp;[P]&nbsp;Paper/Activity&nbsp;·&nbsp;[E]&nbsp;Exam</span>
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
              {students.map((stu, i) => {
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
