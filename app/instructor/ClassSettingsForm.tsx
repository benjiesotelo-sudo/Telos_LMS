'use client'
import { useState, useTransition } from 'react'
import { setClassSettings, CLASS_PERIODS } from '@/app/actions/setClassSettings'

interface ClassSettingsFormProps {
  classId: string
  period: string
  sectionLabel: string
}

export function ClassSettingsForm({
  classId,
  period: initialPeriod,
  sectionLabel: initialSectionLabel,
}: ClassSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)

  const [period, setPeriod] = useState(initialPeriod)
  const [sectionLabel, setSectionLabel] = useState(initialSectionLabel)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sectionLabel.trim()) {
      setStatus('Error: Section label must not be empty')
      return
    }
    startTransition(async () => {
      try {
        await setClassSettings({ classId, period, sectionLabel })
        setStatus('Saved')
        setTimeout(() => setStatus(null), 2000)
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        {/* Period selector */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Period</span>
          <select
            value={period}
            disabled={isPending}
            onChange={(e) => { setPeriod(e.target.value); setStatus(null) }}
            style={selectStyle}
          >
            {CLASS_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {/* Section label input */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Section Label</span>
          <input
            type="text"
            value={sectionLabel}
            disabled={isPending}
            onChange={(e) => { setSectionLabel(e.target.value); setStatus(null) }}
            style={inputStyle}
            placeholder="e.g. 5A"
          />
        </label>

        {/* Save button */}
        <button
          type="submit"
          disabled={isPending}
          className="feu-btn-green"
          style={{ fontSize: 13 }}
        >
          {isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {status && (
        <p
          style={{
            fontSize: 12,
            margin: 0,
            color: status.startsWith('Error') ? '#c0392b' : 'var(--green)',
            fontWeight: 600,
          }}
        >
          {status}
        </p>
      )}
    </form>
  )
}

const selectStyle: React.CSSProperties = {
  fontSize: 14,
  border: '1px solid var(--line, #e2e8e4)',
  borderRadius: 4,
  padding: '4px 8px',
  background: 'var(--bg, #fff)',
  color: 'var(--ink)',
  minWidth: 160,
}

const inputStyle: React.CSSProperties = {
  fontSize: 14,
  border: '1px solid var(--line, #e2e8e4)',
  borderRadius: 4,
  padding: '4px 8px',
  width: 100,
}
