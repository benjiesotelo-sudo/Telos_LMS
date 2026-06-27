'use client'
import { useState } from 'react'
import { setGradeOverrides } from '@/app/actions/setGradeOverrides'
import { computeStudentMarks, type MarkAssessment } from '@/lib/gradebook'
import type { SectionGrades, SectionAssessmentMeta, SectionStudentRow } from '@/lib/types'
import {
  scoreColor,
  letterColor,
  typeTag,
  typeBg,
  splitPeriods,
  MANUAL_TINT,
  EDIT_OUTLINE,
  EDIT_TINT,
} from './gradeStyles'

const k = (s: string, a: string) => `${s}:${a}`
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

export function GradeEditor({ grades, classId }: { grades: SectionGrades; classId: string }) {
  const { assessments, students, class: cls } = grades
  // Signature of saved data → remount (reset staged edits) after a save + refresh().
  const signature = students
    .map((s) =>
      assessments
        .map((a) => `${s.rawOverrides[a.assessmentId] ?? ''}/${s.autoRaw[a.assessmentId] ?? ''}`)
        .join(','),
    )
    .join('|')
  return (
    <EditorGrid
      key={signature}
      assessments={assessments}
      students={students}
      weights={cls.weights}
      classId={classId}
    />
  )
}

function EditorGrid({
  assessments,
  students,
  weights,
  classId,
}: {
  assessments: SectionAssessmentMeta[]
  students: SectionStudentRow[]
  weights: { wtQuiz: number; wtPaper: number; wtExam: number }
  classId: string
}) {
  const { midtermCols, finalCols } = splitPeriods(assessments)
  const mSpan = midtermCols.length + 1
  const fSpan = finalCols.length + 1
  const markAssessments: MarkAssessment[] = assessments.map((a) => ({
    assessmentId: a.assessmentId,
    type: a.type,
    period: a.period,
  }))

  const [edits, setEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // --- per-cell value helpers ---
  function savedRaw(stu: SectionStudentRow, a: SectionAssessmentMeta): string {
    const ov = stu.rawOverrides[a.assessmentId]
    if (ov !== undefined) return String(ov)
    const auto = stu.autoRaw[a.assessmentId]
    if (auto !== undefined) return String(auto)
    return ''
  }
  function valueOf(stu: SectionStudentRow, a: SectionAssessmentMeta): string {
    const key = k(stu.studentId, a.assessmentId)
    return edits[key] !== undefined ? edits[key] : savedRaw(stu, a)
  }
  function previewPct(stu: SectionStudentRow, a: SectionAssessmentMeta): number | null {
    const key = k(stu.studentId, a.assessmentId)
    if (edits[key] === undefined) return stu.cells[a.assessmentId] ?? null
    const t = edits[key].trim()
    if (t === '') {
      const auto = stu.autoRaw[a.assessmentId]
      return auto !== undefined && a.totalPoints > 0 ? (auto / a.totalPoints) * 100 : null
    }
    const n = parseFloat(t)
    if (isNaN(n)) return stu.cells[a.assessmentId] ?? null
    return a.totalPoints > 0 ? (n / a.totalPoints) * 100 : null
  }
  // Save entry for a touched cell, or null for no-op. Throws on an invalid number.
  function entryFor(
    stu: SectionStudentRow,
    a: SectionAssessmentMeta,
  ): { studentId: string; assessmentId: string; score: number | null } | null {
    const key = k(stu.studentId, a.assessmentId)
    if (edits[key] === undefined) return null
    const t = edits[key].trim()
    const auto = stu.autoRaw[a.assessmentId]
    const current = stu.rawOverrides[a.assessmentId]
    let desired: number | null
    if (t === '') desired = null
    else {
      const n = parseFloat(t)
      if (isNaN(n)) throw new Error(`"${stu.fullName || 'student'}" / ${a.title}: "${t}" is not a number`)
      desired = auto !== undefined && n === auto ? null : n
    }
    if (desired === null) {
      return current !== undefined ? { studentId: stu.studentId, assessmentId: a.assessmentId, score: null } : null
    }
    return current === desired ? null : { studentId: stu.studentId, assessmentId: a.assessmentId, score: desired }
  }

  // Build entries + dirty set + destructive count for the current edits.
  let entries: { studentId: string; assessmentId: string; score: number | null }[] = []
  const dirty = new Set<string>()
  let destructive = 0
  let parseError: string | null = null
  try {
    for (const stu of students)
      for (const a of assessments) {
        const e = entryFor(stu, a)
        if (e) {
          entries.push(e)
          dirty.add(k(stu.studentId, a.assessmentId))
          if (e.score === null && stu.autoRaw[a.assessmentId] === undefined) destructive++
        }
      }
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Invalid input'
    entries = []
  }

  function setVal(key: string, v: string) {
    setEdits((p) => ({ ...p, [key]: v }))
  }

  async function handleSave() {
    setError(null)
    setMsg(null)
    if (parseError) {
      setError(parseError)
      return
    }
    if (entries.length === 0) {
      setMsg('No changes to save.')
      return
    }
    if (
      destructive > 0 &&
      !window.confirm(
        `This removes ${destructive} hand-entered score${destructive > 1 ? 's' : ''} with no auto-grade to fall back to — continue?`,
      )
    )
      return
    setSaving(true)
    try {
      await setGradeOverrides({ classId, entries })
      // Server refresh() re-renders the page; the new data remounts this grid
      // (via the signature key) with fresh values and empty staged edits.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save grades.')
      setSaving(false)
    }
  }

  const markCell = (v: number | null) => (v !== null ? `${v.toFixed(2)}%` : '—')

  // Every assessment cell is ALWAYS an input (no click-to-edit). Rendered via a
  // function (not a child component) so inputs keep focus across re-renders; Tab
  // moves between them for free.
  function cell(stu: SectionStudentRow, a: SectionAssessmentMeta) {
    const key = k(stu.studentId, a.assessmentId)
    const isDirty = dirty.has(key)
    const pct = previewPct(stu, a)
    const hasOverride = stu.rawOverrides[a.assessmentId] !== undefined
    const auto = stu.autoRaw[a.assessmentId]
    const borderColor = isDirty ? EDIT_OUTLINE : hasOverride ? 'var(--gold-dk)' : 'var(--border)'
    const bg = isDirty ? EDIT_TINT : hasOverride ? MANUAL_TINT : undefined
    return (
      <td key={a.id} style={{ ...tdStyle, background: bg, textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <input
            type="number"
            min={0}
            step={0.1}
            value={valueOf(stu, a)}
            disabled={saving}
            title={auto !== undefined ? `Auto-grade: ${fmt(auto)} / ${a.totalPoints}` : 'Manual item (no auto-grade)'}
            onChange={(e) => setVal(key, e.target.value)}
            style={{
              width: 50,
              padding: '3px 5px',
              fontSize: 12,
              border: `1.5px solid ${borderColor}`,
              borderRadius: 3,
              textAlign: 'right',
              color: pct !== null ? scoreColor(pct) : 'var(--ink)',
              fontWeight: 500,
              background: '#fff',
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--gray)' }}>/{a.totalPoints}</span>
          {hasOverride &&
            (auto !== undefined ? (
              <button
                type="button"
                disabled={saving}
                title={`Revert to auto-grade (${fmt(auto)})`}
                onClick={() => setVal(key, String(auto))}
                style={iconBtn}
              >
                ↺
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                title="Clear this grade"
                onClick={() => setVal(key, '')}
                style={{ ...iconBtn, color: '#c0392b', borderColor: '#c0392b' }}
              >
                ✕
              </button>
            ))}
        </div>
      </td>
    )
  }

  function marksFor(stu: SectionStudentRow) {
    const cells: Record<string, number | null> = {}
    for (const a of assessments) cells[a.assessmentId] = previewPct(stu, a)
    return computeStudentMarks(cells, markAssessments, weights)
  }

  const colHead = (a: SectionAssessmentMeta, isFirst: boolean) => (
    <th
      key={a.id}
      title={a.title}
      style={{ ...thBase, background: typeBg(a.type), maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: isFirst ? '2px solid var(--green)' : undefined }}
    >
      <span style={{ color: 'var(--gray)', marginRight: 2 }}>[{typeTag(a.type)}]</span>
      {a.title}
    </th>
  )

  return (
    <div className="feu-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, color: 'var(--green)', margin: 0 }}>Grade Editor</h2>
        <span style={{ fontSize: 12, color: 'var(--gray)' }}>
          type a raw score in any cell (Tab moves across); MG / FG / Mark preview live · ↺ reverts to auto · ✕ clears a manual grade
        </span>
      </div>

      {students.length === 0 && <p className="feu-muted">No students enrolled in this section.</p>}
      {students.length > 0 && assessments.length === 0 && (
        <p className="feu-muted">No assessments assigned yet.</p>
      )}

      {students.length > 0 && assessments.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', minWidth: '100%' }}>
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
                  {midtermCols.map((a, i) => colHead(a, i === 0))}
                  <th style={{ ...thBase, background: '#a8d8bc', fontWeight: 700, borderLeft: '1px solid #7bbfa0', textAlign: 'center', minWidth: 56 }}>
                    MG
                  </th>
                  {finalCols.map((a, i) => colHead(a, i === 0))}
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
                  const m = marksFor(stu)
                  return (
                    <tr key={stu.studentId} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
                      <td
                        style={{ ...tdStyle, fontWeight: 500, textAlign: 'left', position: 'sticky', left: 0, background: rowBg, zIndex: 1, borderRight: '1px solid var(--border)' }}
                      >
                        {stu.fullName || <span className="feu-muted">—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--gray)', borderRight: '1px solid var(--border)' }}>
                        {stu.studentNumber ?? '—'}
                      </td>
                      {midtermCols.map((a) => cell(stu, a))}
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: m.midtermMark !== null ? scoreColor(m.midtermMark) : 'var(--gray)' }}>
                        {markCell(m.midtermMark)}
                      </td>
                      {finalCols.map((a) => cell(stu, a))}
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#edf7f2', borderLeft: '1px solid #a8d4be', textAlign: 'center', color: m.finalMark !== null ? scoreColor(m.finalMark) : 'var(--gray)' }}>
                        {markCell(m.finalMark)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', borderLeft: '2px solid var(--gold)', textAlign: 'center', color: m.courseMark !== null ? scoreColor(m.courseMark) : 'var(--gray)' }}>
                        {markCell(m.courseMark)}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, background: '#fffce8', textAlign: 'center', color: letterColor(m.letter) }}>
                        {m.letter ?? '—'}
                        {m.qp !== null && <span style={{ fontSize: 10, color: 'var(--gray)', marginLeft: 3 }}>({m.qp.toFixed(1)})</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || entries.length === 0}
              style={{
                padding: '7px 18px',
                background: 'var(--green)',
                color: '#fff',
                border: 'none',
                borderRadius: 5,
                fontSize: 13,
                fontWeight: 600,
                cursor: saving || entries.length === 0 ? 'default' : 'pointer',
                opacity: saving || entries.length === 0 ? 0.55 : 1,
              }}
            >
              {saving ? 'Saving…' : `Save changes${entries.length ? ` (${entries.length} edited)` : ''}`}
            </button>
            {entries.length > 0 && !saving && (
              <button
                type="button"
                onClick={() => {
                  setEdits({})
                  setError(null)
                  setMsg(null)
                }}
                style={{ padding: '7px 12px', background: '#fff', color: 'var(--gray)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, cursor: 'pointer' }}
              >
                Discard
              </button>
            )}
            {error && <span style={{ color: '#c0392b', fontSize: 13 }}>{error}</span>}
            {msg && <span style={{ color: 'var(--gray)', fontSize: 13 }}>{msg}</span>}
          </div>
        </>
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
const tdStyle: React.CSSProperties = { padding: '6px 8px', color: 'var(--ink)', textAlign: 'right' }
const iconBtn: React.CSSProperties = {
  padding: '1px 5px',
  fontSize: 11,
  lineHeight: 1.3,
  background: '#fff',
  color: 'var(--gold-dk)',
  border: '1px solid var(--gold-dk)',
  borderRadius: 3,
  cursor: 'pointer',
}
