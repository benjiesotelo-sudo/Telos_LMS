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
  const initialDuration = assignment.durationMinutes != null ? String(assignment.durationMinutes) : ''
  const [duration, setDuration] = useState(initialDuration)

  // Reveal gate (mirrors getRevealedAnswers): for a quiz/exam/homework, answers reveal
  // immediately when there's no Closes time, or once a set Closes time has passed. Only a
  // FUTURE Closes time holds them back — note that to the instructor so it's not a surprise.
  const revealHeldUntilClose =
    revealAnswers &&
    assignment.type !== 'activity' &&
    closesAt !== '' &&
    new Date(closesAt) > new Date()

  // Saves ONLY the time limit (independent of the date fields). Blank = untimed.
  function saveDuration() {
    // No-op if the field wasn't actually changed — avoids converting an inherited
    // assessment default into an explicit per-assignment override on a stray blur.
    if (duration.trim() === initialDuration.trim()) return
    const t = duration.trim()
    const minutes = t === '' ? null : parseFloat(t)
    if (minutes !== null && (isNaN(minutes) || minutes <= 0)) {
      setStatus('Error: time limit must be a positive number')
      return
    }
    startTransition(async () => {
      try {
        await setAssignmentMeta({ assignmentId: assignment.assignmentId, durationMinutes: minutes })
        setStatus('Saved')
        setTimeout(() => setStatus(null), 2000)
      } catch (e) {
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
  }

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
          // Empty string = the user cleared the field → send null to NULL the
          // column. A non-empty string sets it. (This control manages all three
          // date fields together, so we always send an explicit value.)
          opensAt: merged.opensAt === '' ? null : merged.opensAt,
          closesAt: merged.closesAt === '' ? null : merged.closesAt,
          dueDate: merged.dueDate === '' ? null : merged.dueDate,
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

      {/* Reveal note — a FUTURE Closes time delays reveal until it passes. */}
      {revealHeldUntilClose && (
        <div
          style={{
            fontSize: 12,
            color: '#8a6d00',
            background: '#fff8e1',
            border: '1px solid #f2d479',
            borderRadius: 6,
            padding: '6px 10px',
          }}
        >
          ℹ️ Reveal Answers is on. Students will see the correct answers{' '}
          <strong>after the “Closes” time passes</strong>. Clear the Closes time to reveal
          immediately when they submit.
        </div>
      )}

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
        {!assignment.isManual && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span className="feu-muted">Time limit:</span>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="untimed"
              value={duration}
              disabled={isPending}
              onChange={(e) => setDuration(e.target.value)}
              onBlur={saveDuration}
              title="Per-attempt minutes for this section. Blank = untimed / use the assessment default."
              style={{ width: 78, fontSize: 12, border: '1px solid var(--line, #e2e8e4)', borderRadius: 4, padding: '2px 4px' }}
            />
            <span className="feu-muted">min</span>
          </label>
        )}
      </div>
    </div>
  )
}
