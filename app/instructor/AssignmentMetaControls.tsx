'use client'
import { useState, useTransition } from 'react'
import { setAssignmentMeta } from '@/app/actions/setAssignmentMeta'
import type { ClassDetailAssessment } from '@/lib/types'

interface AssignmentMetaControlsProps {
  assignment: ClassDetailAssessment
}

export function AssignmentMetaControls({ assignment }: AssignmentMetaControlsProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)

  // Local state mirrors the current values so the UI feels responsive.
  const [active, setActive] = useState(assignment.active)
  const [revealAnswers, setRevealAnswers] = useState(assignment.revealAnswers)
  const [period, setPeriod] = useState<'midterm' | 'final'>(assignment.period)
  const [opensAt, setOpensAt] = useState(assignment.opensAt ?? '')
  const [closesAt, setClosesAt] = useState(assignment.closesAt ?? '')
  const [dueDate, setDueDate] = useState(assignment.dueDate ?? '')

  function save(overrides: Partial<{
    active: boolean
    revealAnswers: boolean
    period: 'midterm' | 'final'
    opensAt: string
    closesAt: string
    dueDate: string
  }> = {}) {
    const merged = {
      active,
      revealAnswers,
      period,
      opensAt,
      closesAt,
      dueDate,
      ...overrides,
    }
    startTransition(async () => {
      try {
        await setAssignmentMeta({
          assignmentId: assignment.assignmentId,
          active: merged.active,
          revealAnswers: merged.revealAnswers,
          period: merged.period,
          opensAt: merged.opensAt || undefined,
          closesAt: merged.closesAt || undefined,
          dueDate: merged.dueDate || undefined,
        })
        setStatus('Saved')
        setTimeout(() => setStatus(null), 2000)
      } catch (e) {
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Toggles row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        {/* Active toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={active}
            disabled={isPending}
            onChange={(e) => {
              setActive(e.target.checked)
              save({ active: e.target.checked })
            }}
            style={{ accentColor: 'var(--green)' }}
          />
          Active
        </label>

        {/* Reveal answers toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={revealAnswers}
            disabled={isPending}
            onChange={(e) => {
              setRevealAnswers(e.target.checked)
              save({ revealAnswers: e.target.checked })
            }}
            style={{ accentColor: 'var(--green)' }}
          />
          Reveal Answers
        </label>

        {/* Period select */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Period:&nbsp;
          <select
            value={period}
            disabled={isPending}
            onChange={(e) => {
              const p = e.target.value as 'midterm' | 'final'
              setPeriod(p)
              save({ period: p })
            }}
            style={{
              fontSize: 13,
              border: '1px solid var(--line, #e2e8e4)',
              borderRadius: 4,
              padding: '2px 6px',
              background: 'white',
            }}
          >
            <option value="midterm">Midterm</option>
            <option value="final">Final</option>
          </select>
        </label>

        {status && (
          <span
            style={{
              fontSize: 12,
              color: status.startsWith('Error') ? '#c0392b' : 'var(--green)',
              fontWeight: 600,
            }}
          >
            {status}
          </span>
        )}
      </div>

      {/* Deadlines row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span className="feu-muted">Opens:</span>
          <input
            type="datetime-local"
            value={opensAt ? opensAt.slice(0, 16) : ''}
            disabled={isPending}
            onChange={(e) => setOpensAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
            onBlur={() => save()}
            style={{ fontSize: 12, border: '1px solid var(--line, #e2e8e4)', borderRadius: 4, padding: '2px 4px' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span className="feu-muted">Closes:</span>
          <input
            type="datetime-local"
            value={closesAt ? closesAt.slice(0, 16) : ''}
            disabled={isPending}
            onChange={(e) => setClosesAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
            onBlur={() => save()}
            style={{ fontSize: 12, border: '1px solid var(--line, #e2e8e4)', borderRadius: 4, padding: '2px 4px' }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span className="feu-muted">Due:</span>
          <input
            type="date"
            value={dueDate ? dueDate.slice(0, 10) : ''}
            disabled={isPending}
            onChange={(e) => setDueDate(e.target.value || '')}
            onBlur={() => save()}
            style={{ fontSize: 12, border: '1px solid var(--line, #e2e8e4)', borderRadius: 4, padding: '2px 4px' }}
          />
        </label>
      </div>
    </div>
  )
}
