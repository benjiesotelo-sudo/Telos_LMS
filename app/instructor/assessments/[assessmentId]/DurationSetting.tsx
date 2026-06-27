'use client'
import { useState } from 'react'
import { setAssessmentDuration } from '@/app/actions/setAssessmentDuration'

export function DurationSetting({
  assessmentId,
  current,
}: {
  assessmentId: string
  current: number | null
}) {
  const [value, setValue] = useState<string>(current != null ? String(current) : '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const trimmed = value.trim()
      const minutes = trimmed === '' ? null : parseFloat(trimmed)
      if (minutes !== null && (isNaN(minutes) || minutes <= 0)) {
        setMsg('Enter a positive number of minutes, or leave blank for untimed.')
        setSaving(false)
        return
      }
      await setAssessmentDuration({ assessmentId, minutes })
      setMsg('Saved.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label htmlFor="dur" style={{ fontSize: 13, fontWeight: 600 }}>
        Default time limit:
      </label>
      <input
        id="dur"
        type="number"
        min={1}
        step={1}
        value={value}
        disabled={saving}
        placeholder="untimed"
        onChange={(e) => setValue(e.target.value)}
        style={{ width: 90, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13 }}
      />
      <span className="feu-muted" style={{ fontSize: 13 }}>minutes (blank = untimed)</span>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="feu-btn-outline"
        style={{ fontSize: 13, padding: '4px 12px' }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {msg && <span className="feu-muted" style={{ fontSize: 12 }}>{msg}</span>}
      <span className="feu-muted" style={{ fontSize: 12, flexBasis: '100%' }}>
        Pre-fills the limit when this assessment is assigned to a section; each section can override it.
      </span>
    </div>
  )
}
