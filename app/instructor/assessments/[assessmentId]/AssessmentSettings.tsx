'use client'
import { useState } from 'react'
import { updateAssessmentSettings } from '@/app/actions/updateAssessmentSettings'
import type { AssessmentType } from '@/lib/types'

export function AssessmentSettings({
  assessmentId,
  title,
  type,
  defaultDuration,
  isManual,
  isGraded,
}: {
  assessmentId: string
  title: string
  type: AssessmentType
  defaultDuration: number | null
  isManual: boolean
  isGraded: boolean
}) {
  const [name, setName] = useState(title)
  const [kind, setKind] = useState<AssessmentType>(type)
  const [dur, setDur] = useState<string>(defaultDuration != null ? String(defaultDuration) : '')
  const [graded, setGraded] = useState(isGraded)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Quizzes & exams are always graded; only homework/activity can be ungraded (practice).
  const canBeUngraded = kind === 'homework' || kind === 'activity'
  const effectiveGraded = canBeUngraded ? graded : true

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const trimmed = dur.trim()
      const minutes = trimmed === '' ? null : parseFloat(trimmed)
      if (minutes !== null && (isNaN(minutes) || minutes <= 0)) {
        setMsg('Time limit must be a positive number, or blank for untimed.')
        setSaving(false)
        return
      }
      if (name.trim().length === 0) {
        setMsg('Name cannot be empty.')
        setSaving(false)
        return
      }
      await updateAssessmentSettings({
        assessmentId,
        title: name,
        type: kind,
        defaultDurationMinutes: minutes,
        isGraded: effectiveGraded,
      })
      setMsg('Saved.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }
  const input: React.CSSProperties = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13 }

  const typeChanged = kind !== type

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 460 }}>
      <div>
        <label style={fieldLabel} htmlFor="as-name">Name</label>
        <input id="as-name" value={name} disabled={saving} onChange={(e) => setName(e.target.value)} style={{ ...input, width: '100%' }} />
      </div>

      <div>
        <label style={fieldLabel} htmlFor="as-type">Type</label>
        <select id="as-type" value={kind} disabled={saving} onChange={(e) => setKind(e.target.value as AssessmentType)} style={{ ...input, width: 200, cursor: 'pointer' }}>
          <option value="quiz">Quiz</option>
          <option value="homework">Homework</option>
          <option value="activity">Activity</option>
          <option value="exam">Exam</option>
        </select>
        {typeChanged && (
          <p className="feu-muted" style={{ fontSize: 12, margin: '6px 0 0', color: 'var(--gold-dk)' }}>
            Changing the type changes which weight category this counts in (quiz / papers-HW / exam). Existing submissions are unaffected.
          </p>
        )}
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: canBeUngraded ? 'pointer' : 'default' }}>
          <input
            type="checkbox"
            checked={effectiveGraded}
            disabled={saving || !canBeUngraded}
            onChange={(e) => setGraded(e.target.checked)}
            style={{ accentColor: 'var(--green)' }}
          />
          Counts toward the grade
        </label>
        <p className="feu-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>
          {canBeUngraded
            ? 'Uncheck for practice work — it still shows a score for feedback but is excluded from the computed marks.'
            : 'Quizzes and exams always count toward the grade.'}
        </p>
      </div>

      <div>
        <label style={fieldLabel} htmlFor="as-dur">
          Default time limit{isManual ? ' (not applicable — manual/offline)' : ''}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id="as-dur" type="number" min={1} step={1} value={dur} disabled={saving || isManual} placeholder="untimed" onChange={(e) => setDur(e.target.value)} style={{ ...input, width: 100 }} />
          <span className="feu-muted" style={{ fontSize: 13 }}>minutes (blank = untimed)</span>
        </div>
        {!isManual && (
          <p className="feu-muted" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Pre-fills the limit when this assessment is assigned to a section; each section can override it.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={save} disabled={saving} className="feu-btn-green" style={{ fontSize: 13 }}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {msg && (
          <span className={msg === 'Saved.' ? 'feu-muted' : 'feu-error'} style={{ fontSize: 13 }}>{msg}</span>
        )}
      </div>
    </div>
  )
}
