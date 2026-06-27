'use client'
import { useState } from 'react'
import { setGradeOverride } from '@/app/actions/setGradeOverride'
import type { SectionGrades, SectionAssessmentMeta } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function letterColor(letter: string | null): string {
  if (!letter) return 'var(--gray)'
  if (letter === 'A') return 'var(--green)'
  if (letter.startsWith('B')) return '#2563eb'
  if (letter.startsWith('C')) return 'var(--gold-dk)'
  if (letter.startsWith('D')) return '#ea580c'
  return '#c0392b' // F
}

function scoreColor(pct: number): string {
  if (pct >= 75) return 'var(--green)'
  if (pct >= 50) return 'var(--gold-dk)'
  return '#c0392b'
}

function typeTag(t: string): string {
  return t === 'quiz' ? 'Q' : t === 'activity' ? 'P' : 'E'
}

function typeBg(t: string): string {
  return t === 'quiz' ? '#f0f9f4' : t === 'activity' ? '#fffbeb' : '#eef2ff'
}

function assessmentOrder(a: SectionAssessmentMeta): number {
  return a.type === 'quiz' ? 0 : a.type === 'activity' ? 1 : 2
}

// ── OverrideCell ─────────────────────────────────────────────────────────────

interface OverrideCellProps {
  /** Computed cell percentage (displayed value). */
  value: number | null
  studentId: string
  assessmentId: string
  classId: string
  /** Assessment's total_points — shown as "/ {totalPoints}" hint in edit mode. */
  totalPoints: number
  /**
   * The raw override score already stored for this cell (from rawOverrides).
   * Used to prefill the edit input so the instructor sees what they entered last.
   * Undefined when no override exists (cell is from an auto-graded submission or empty).
   */
  rawScore: number | undefined
}

function OverrideCell({
  value,
  studentId,
  assessmentId,
  classId,
  totalPoints,
  rawScore,
}: OverrideCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const trimmed = inputVal.trim()
    if (trimmed === '') {
      setEditing(false)
      return
    }
    const num = parseFloat(trimmed)
    if (isNaN(num)) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      // Score is stored as the raw value (e.g. 85 on a 100-pt item).
      // getSectionGrades converts it to % via: raw / total_points * 100.
      // setGradeOverride calls server-side refresh() (next/cache), which
      // re-renders this page with the recomputed marks — no client refresh needed.
      await setGradeOverride({ studentId, assessmentId, classId, score: num })
    } catch (err) {
      console.error('Grade override failed:', err)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (saving) {
    return (
      <td style={tdStyle}>
        <span style={{ color: 'var(--gray)', fontSize: 11 }}>saving…</span>
      </td>
    )
  }

  if (editing) {
    return (
      <td style={tdStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <input
            autoFocus
            type="number"
            min={0}
            step={0.1}
            value={inputVal}
            title={`Enter raw score out of ${totalPoints}`}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSave()
              }
              if (e.key === 'Escape') {
                // Clear first so the blur-triggered handleSave early-returns
                // on empty input (Escape must cancel, not persist).
                setInputVal('')
                setEditing(false)
              }
            }}
            style={{
              width: 48,
              padding: '2px 4px',
              fontSize: 12,
              border: '1.5px solid var(--green)',
              borderRadius: 3,
              outline: 'none',
              textAlign: 'right',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--gray)', whiteSpace: 'nowrap' }}>
            / {totalPoints}
          </span>
        </div>
      </td>
    )
  }

  return (
    <td
      style={{ ...tdStyle, cursor: 'pointer', userSelect: 'none' }}
      title={`Click to enter raw score out of ${totalPoints} (system computes %)`}
      onClick={() => {
        // Prefill with the previously-entered raw score if an override exists;
        // otherwise leave blank so the instructor enters a fresh value.
        setInputVal(rawScore !== undefined ? String(rawScore) : '')
        setEditing(true)
      }}
    >
      {value !== null ? (
        <span style={{ color: scoreColor(value), fontWeight: 500 }}>
          {value.toFixed(1)}
        </span>
      ) : (
        <span style={{ color: 'var(--gray)' }}>—</span>
      )}
    </td>
  )
}

// ── GradeSheet ────────────────────────────────────────────────────────────────

interface Props {
  grades: SectionGrades
  classId: string
}

export function GradeSheet({ grades, classId }: Props) {
  const { class: cls, assessments, students } = grades

  // Sort within each period: quizzes → activities → exams
  const midtermCols = assessments
    .filter((a) => a.period === 'midterm')
    .sort((a, b) => assessmentOrder(a) - assessmentOrder(b))

  const finalCols = assessments
    .filter((a) => a.period === 'final')
    .sort((a, b) => assessmentOrder(a) - assessmentOrder(b))

  // +1 accounts for the period-mark column (MG / FG)
  const mSpan = midtermCols.length + 1
  const fSpan = finalCols.length + 1

  const { wtQuiz, wtPaper, wtExam } = cls.weights

  return (
    <div className="feu-card" style={{ marginBottom: 20 }}>
      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, color: 'var(--green)', margin: 0 }}>{cls.displayName}</h2>
        <span style={{ fontSize: 12, color: 'var(--gray)' }}>
          {students.length} student{students.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Legend / weights ── */}
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
          {wtQuiz}%&nbsp;·&nbsp;Papers/HW&nbsp;{wtPaper}%&nbsp;·&nbsp;Exam&nbsp;{wtExam}%
        </span>
        <span style={{ color: 'var(--gray)' }}>
          [Q]&nbsp;=&nbsp;Quiz &nbsp;·&nbsp; [P]&nbsp;=&nbsp;Paper/Activity &nbsp;·&nbsp;
          [E]&nbsp;=&nbsp;Exam
        </span>
        <span style={{ color: 'var(--gray)' }}>
          Click any score cell to enter a raw score out of the item&apos;s points — the system computes the %.
        </span>
      </div>

      {students.length === 0 && (
        <p className="feu-muted">No students enrolled in this section.</p>
      )}

      {students.length > 0 && assessments.length === 0 && (
        <p className="feu-muted">
          No assessments assigned yet. Add assessments from the class detail page.
        </p>
      )}

      {students.length > 0 && assessments.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              fontSize: 12,
              whiteSpace: 'nowrap',
              minWidth: '100%',
            }}
          >
            <thead>
              {/* ── Row 1: Group headers ─── */}
              <tr>
                <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 140 }}>
                  Name
                </th>
                <th rowSpan={2} style={{ ...thBase, textAlign: 'left', minWidth: 90 }}>
                  Student&nbsp;#
                </th>
                <th
                  colSpan={mSpan}
                  style={{
                    ...groupTh,
                    background: '#c4e8d4',
                    borderLeft: '2px solid var(--green)',
                  }}
                >
                  MIDTERM
                </th>
                <th
                  colSpan={fSpan}
                  style={{
                    ...groupTh,
                    background: '#c4e8d4',
                    borderLeft: '2px solid var(--green)',
                  }}
                >
                  FINAL
                </th>
                <th
                  colSpan={2}
                  style={{
                    ...groupTh,
                    background: '#ffe99a',
                    borderLeft: '2px solid var(--gold)',
                  }}
                >
                  COURSE GRADE
                </th>
              </tr>

              {/* ── Row 2: Assessment titles + period-mark labels ─── */}
              <tr>
                {midtermCols.map((a, i) => (
                  <th
                    key={a.id}
                    style={{
                      ...thBase,
                      background: typeBg(a.type),
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      borderLeft: i === 0 ? '2px solid var(--green)' : undefined,
                    }}
                    title={a.title}
                  >
                    <span style={{ color: 'var(--gray)', marginRight: 2 }}>
                      [{typeTag(a.type)}]
                    </span>
                    {a.title}
                  </th>
                ))}
                <th
                  style={{
                    ...thBase,
                    background: '#a8d8bc',
                    fontWeight: 700,
                    borderLeft: '1px solid #7bbfa0',
                    textAlign: 'center',
                    minWidth: 52,
                  }}
                >
                  MG
                </th>

                {finalCols.map((a, i) => (
                  <th
                    key={a.id}
                    style={{
                      ...thBase,
                      background: typeBg(a.type),
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      borderLeft: i === 0 ? '2px solid var(--green)' : undefined,
                    }}
                    title={a.title}
                  >
                    <span style={{ color: 'var(--gray)', marginRight: 2 }}>
                      [{typeTag(a.type)}]
                    </span>
                    {a.title}
                  </th>
                ))}
                <th
                  style={{
                    ...thBase,
                    background: '#a8d8bc',
                    fontWeight: 700,
                    borderLeft: '1px solid #7bbfa0',
                    textAlign: 'center',
                    minWidth: 52,
                  }}
                >
                  FG
                </th>

                <th
                  style={{
                    ...thBase,
                    background: '#fcd34d',
                    fontWeight: 700,
                    borderLeft: '2px solid var(--gold)',
                    textAlign: 'center',
                    minWidth: 60,
                  }}
                >
                  MARK
                </th>
                <th
                  style={{
                    ...thBase,
                    background: '#fcd34d',
                    fontWeight: 700,
                    textAlign: 'center',
                    minWidth: 48,
                  }}
                >
                  LG
                </th>
              </tr>
            </thead>

            <tbody>
              {students.map((stu, i) => {
                const rowBg = i % 2 === 0 ? '#fff' : '#f8fbf9'
                return (
                  <tr
                    key={stu.studentId}
                    style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}
                  >
                    {/* Name — sticky so it stays visible while scrolling */}
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

                    {/* Student # */}
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'left',
                        color: 'var(--gray)',
                        borderRight: '1px solid var(--border)',
                      }}
                    >
                      {stu.studentNumber ?? '—'}
                    </td>

                    {/* Midterm assessment cells */}
                    {midtermCols.map((a) => (
                      <OverrideCell
                        key={a.id}
                        value={stu.cells[a.assessmentId] ?? null}
                        studentId={stu.studentId}
                        assessmentId={a.assessmentId}
                        classId={classId}
                        totalPoints={a.totalPoints}
                        rawScore={stu.rawOverrides[a.assessmentId]}
                      />
                    ))}

                    {/* Midterm Grade (MG) */}
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        background: '#edf7f2',
                        borderLeft: '1px solid #a8d4be',
                        textAlign: 'center',
                        color:
                          stu.midtermMark !== null
                            ? scoreColor(stu.midtermMark)
                            : 'var(--gray)',
                      }}
                    >
                      {stu.midtermMark !== null ? stu.midtermMark.toFixed(2) : '—'}
                    </td>

                    {/* Final assessment cells */}
                    {finalCols.map((a) => (
                      <OverrideCell
                        key={a.id}
                        value={stu.cells[a.assessmentId] ?? null}
                        studentId={stu.studentId}
                        assessmentId={a.assessmentId}
                        classId={classId}
                        totalPoints={a.totalPoints}
                        rawScore={stu.rawOverrides[a.assessmentId]}
                      />
                    ))}

                    {/* Final Grade (FG) */}
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        background: '#edf7f2',
                        borderLeft: '1px solid #a8d4be',
                        textAlign: 'center',
                        color:
                          stu.finalMark !== null
                            ? scoreColor(stu.finalMark)
                            : 'var(--gray)',
                      }}
                    >
                      {stu.finalMark !== null ? stu.finalMark.toFixed(2) : '—'}
                    </td>

                    {/* Course Mark */}
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        background: '#fffce8',
                        borderLeft: '2px solid var(--gold)',
                        textAlign: 'center',
                        color:
                          stu.courseMark !== null
                            ? scoreColor(stu.courseMark)
                            : 'var(--gray)',
                      }}
                    >
                      {stu.courseMark !== null ? stu.courseMark.toFixed(2) : '—'}
                    </td>

                    {/* Letter Grade */}
                    <td
                      style={{
                        ...tdStyle,
                        fontWeight: 700,
                        background: '#fffce8',
                        textAlign: 'center',
                        color: letterColor(stu.letter),
                      }}
                    >
                      {stu.letter ?? '—'}
                      {stu.qp !== null && (
                        <span style={{ fontSize: 10, color: 'var(--gray)', marginLeft: 3 }}>
                          ({stu.qp.toFixed(1)})
                        </span>
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

// ── Shared styles ─────────────────────────────────────────────────────────────

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

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  color: 'var(--ink)',
  textAlign: 'right',
}
