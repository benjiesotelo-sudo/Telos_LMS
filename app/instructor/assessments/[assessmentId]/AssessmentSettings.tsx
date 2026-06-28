'use client'
import { useState } from 'react'
import { updateAssessmentSettings } from '@/app/actions/updateAssessmentSettings'

export function AssessmentSettings({
  assessmentId,
  title,
  type,
  defaultDuration,
  isManual,
}: {
  assessmentId: string
  title: string
  type: 'activity' | 'quiz' | 'exam'
  defaultDuration: number | null
  isManual: boolean
}) {
  const [name, setName] = useState(title)
  const [kind, setKind] = useState<'activity' | 'quiz' | 'exam'>(type)
  const [dur, setDur] = useState<string>(defaultDuration != null ? String(defaultDuration) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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
        <select id="as-type" value={kind} disabled={saving} onChange={(e) => setKind(e.target.value as 'activity' | 'quiz' | 'exam')} style={{ ...input, width: 200, cursor: 'pointer' }}>
          <option value="quiz">Quiz</option>
          <option value="activity">Homework / Activity</option>
          <option value="exam">Exam</option>
        </select>
        {typeChanged && (
          <p className="feu-muted" style={{ fontSize: 12, margin: '6px 0 0', color: 'var(--gold-dk)' }}>
            Changing the type changes which weight category this counts in (quiz / papers-HW / exam). Existing submissions are unaffected.
          </p>
        )}
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
