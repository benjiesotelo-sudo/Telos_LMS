'use client'
import { useState } from 'react'
import { setGradeOverrides } from '@/app/actions/setGradeOverrides'
import { deleteGradeOverride } from '@/app/actions/deleteGradeOverride'
import type { SectionGrades, SectionAssessmentMeta, SectionStudentRow } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function typeTag(t: string): string {
  return t === 'quiz' ? 'Q' : t === 'activity' ? 'P' : 'E'
}

function periodLabel(p: string): string {
  return p === 'midterm' ? 'Midterm' : 'Final'
}

/** Trim trailing zeros so "28.00" shows as "28" but "93.33" stays. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

// ── GradeEditor (wrapper: dropdown + remount key) ──────────────────────────────

interface Props {
  grades: SectionGrades
  classId: string
  selectedAssessmentId: string | null
  onSelectAssessment: (assessmentId: string) => void
}

export function GradeEditor({ grades, classId, selectedAssessmentId, onSelectAssessment }: Props) {
  const { assessments, students } = grades
  const meta = assessments.find((a) => a.assessmentId === selectedAssessmentId) ?? null

  // Signature changes whenever the stored override / auto value for the selected
  // column changes (after a Save or revert + server refresh()), remounting
  // ColumnEditor so its inputs re-initialise from the fresh data.
  const signature = meta
    ? students
        .map(
          (s) =>
            `${s.studentId}:${s.rawOverrides[meta.assessmentId] ?? ''}:${s.autoRaw[meta.assessmentId] ?? ''}`,
        )
        .join('|')
    : ''

  return (
    <div className="feu-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: 16, color: 'var(--green)', margin: 0 }}>Grade editor</h2>
        <span style={{ fontSize: 12, color: 'var(--gray)' }}>enter raw scores for one assessment</span>
      </div>
      <p className="feu-muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
        Pick an assessment (or click a column header above). Enter each student&apos;s raw score out
        of the item&apos;s points; the system computes the %. Leave a cell at its auto value (or use
        ↺) to keep the auto-grade.
      </p>

      {/* Assessment picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <label htmlFor="ge-assessment" style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
          Assessment:
        </label>
        <select
          id="ge-assessment"
          value={selectedAssessmentId ?? ''}
          onChange={(e) => onSelectAssessment(e.target.value)}
          style={{
            flex: 1,
            maxWidth: 460,
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 5,
            fontSize: 13,
            color: 'var(--ink)',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <option value="">— select an assessment —</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.assessmentId}>
              [{typeTag(a.type)}] {a.title} — {periodLabel(a.period)} · /{a.totalPoints}
            </option>
          ))}
        </select>
      </div>

      {!meta && (
        <p className="feu-muted" style={{ marginTop: 4 }}>
          Choose an assessment to enter scores.
        </p>
      )}

      {meta && students.length === 0 && (
        <p className="feu-muted">No students enrolled in this section.</p>
      )}

      {meta && students.length > 0 && (
        <ColumnEditor key={`${meta.assessmentId}::${signature}`} meta={meta} students={students} classId={classId} />
      )}
    </div>
  )
}

// ── ColumnEditor (one assessment column) ───────────────────────────────────────

function ColumnEditor({
  meta,
  students,
  classId,
}: {
  meta: SectionAssessmentMeta
  students: SectionStudentRow[]
  classId: string
}) {
  const aid = meta.assessmentId

  // Prefill: override score if present, else auto raw score, else blank.
  function initialValue(stu: SectionStudentRow): string {
    const ov = stu.rawOverrides[aid]
    if (ov !== undefined) return String(ov)
    const auto = stu.autoRaw[aid]
    if (auto !== undefined) return String(auto)
    return ''
  }

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const s of students) init[s.studentId] = initialValue(s)
    return init
  })
  const [saving, setSaving] = useState(false)
  const [reverting, setReverting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const busy = saving || reverting !== null

  // Decide what (if anything) changed for one student.
  // Returns { score: number | null } as a change to send, or null for no-op.
  function changeFor(stu: SectionStudentRow): { score: number | null } | null {
    const raw = (inputs[stu.studentId] ?? '').trim()
    const auto = stu.autoRaw[aid]
    const current = stu.rawOverrides[aid] // number | undefined

    // Desired override: none (null) for blank or when the entry equals the auto
    // value (don't store a redundant override — decision #2). Otherwise the number.
    let desired: number | null
    if (raw === '') {
      desired = null
    } else {
      const num = parseFloat(raw)
      if (isNaN(num)) throw new Error(`"${stu.fullName || 'student'}": "${raw}" is not a number`)
      desired = auto !== undefined && num === auto ? null : num
    }

    if (desired === null) {
      return current !== undefined ? { score: null } : null // delete only if one exists
    }
    return current === desired ? null : { score: desired }
  }

  async function handleSave() {
    setError(null)
    setSavedMsg(null)

    let entries: { studentId: string; score: number | null }[]
    try {
      entries = students
        .map((s) => {
          const ch = changeFor(s)
          return ch ? { studentId: s.studentId, score: ch.score } : null
        })
        .filter((e): e is { studentId: string; score: number | null } => e !== null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input.')
      return
    }

    if (entries.length === 0) {
      setSavedMsg('No changes to save.')
      return
    }

    setSaving(true)
    try {
      await setGradeOverrides({ classId, assessmentId: aid, entries })
      // Server refresh() re-renders the page; the new data remounts this editor
      // (via the signature key) with fresh prefills. Nothing more to do here.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save grades.')
      setSaving(false)
    }
  }

  async function handleRevert(studentId: string) {
    setError(null)
    setSavedMsg(null)
    setReverting(studentId)
    try {
      await deleteGradeOverride({ studentId, assessmentId: aid, classId })
      // refresh() → remount with auto value prefilled.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revert.')
      setReverting(null)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 10,
          fontSize: 13,
        }}
      >
        <strong style={{ color: 'var(--ink)' }}>
          [{typeTag(meta.type)}] {meta.title}
        </strong>
        <span style={{ color: 'var(--gray)' }}>
          {periodLabel(meta.period)} · out of {meta.totalPoints} pts
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 460 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 200 }}>Student</th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 110 }}>Student&nbsp;#</th>
              <th style={{ ...thStyle, textAlign: 'center', minWidth: 150 }}>
                Raw score / {meta.totalPoints}
              </th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 90 }}>Auto</th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {students.map((stu, i) => {
              const auto = stu.autoRaw[aid]
              const hasOverride = stu.rawOverrides[aid] !== undefined
              const rowBg = i % 2 === 0 ? '#fff' : '#f8fbf9'
              return (
                <tr key={stu.studentId} style={{ background: rowBg, borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>
                    {stu.fullName || <span className="feu-muted">—</span>}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--gray)' }}>{stu.studentNumber ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={inputs[stu.studentId] ?? ''}
                        disabled={busy}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [stu.studentId]: e.target.value }))
                        }
                        style={{
                          width: 70,
                          padding: '4px 6px',
                          fontSize: 13,
                          border: `1.5px solid ${hasOverride ? 'var(--gold-dk)' : 'var(--border)'}`,
                          borderRadius: 4,
                          textAlign: 'right',
                          background: '#fff',
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--gray)' }}>/ {meta.totalPoints}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--gray)', fontSize: 12 }}>
                    {auto !== undefined ? `auto ${fmt(auto)}` : '—'}
                  </td>
                  <td style={tdStyle}>
                    {hasOverride && (
                      <button
                        type="button"
                        onClick={() => handleRevert(stu.studentId)}
                        disabled={busy}
                        title="Revert to the auto-grade (delete this override)"
                        style={{
                          padding: '3px 8px',
                          fontSize: 12,
                          background: '#fff',
                          color: 'var(--gold-dk)',
                          border: '1px solid var(--gold-dk)',
                          borderRadius: 4,
                          cursor: busy ? 'default' : 'pointer',
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {reverting === stu.studentId ? '…' : '↺ revert'}
                      </button>
                    )}
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
          disabled={busy}
          style={{
            padding: '7px 18px',
            background: 'var(--green)',
            color: '#fff',
            border: 'none',
            borderRadius: 5,
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save column'}
        </button>
        {error && <span style={{ color: '#c0392b', fontSize: 13 }}>{error}</span>}
        {savedMsg && <span style={{ color: 'var(--gray)', fontSize: 13 }}>{savedMsg}</span>}
      </div>
    </div>
  )
}

// ── styles ─────────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  color: '#3c5a48',
  borderBottom: '2px solid var(--border)',
  background: '#f1f7f3',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  color: 'var(--ink)',
  textAlign: 'left',
}
