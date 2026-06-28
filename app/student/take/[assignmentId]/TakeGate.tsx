'use client'
import { useState } from 'react'
import { startAttempt } from '@/app/actions/startAttempt'
import TakeForm from './TakeForm'
import type { Question } from '@/lib/types'

interface Props {
  assignmentId: string
  questions: Question[]
  timed: boolean
  durationMinutes: number | null
  started: boolean
  deadline: string | null
}

/**
 * Gates a timed quiz behind a pre-quiz screen: the countdown only starts when the
 * student clicks "Start". Untimed quizzes, or a timed quiz already in progress
 * (resume), go straight to the form.
 */
export default function TakeGate({ assignmentId, questions, timed, durationMinutes, started, deadline }: Props) {
  const [phase, setPhase] = useState<'intro' | 'taking'>(timed && !started ? 'intro' : 'taking')
  const [liveDeadline, setLiveDeadline] = useState<string | null>(deadline)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function begin() {
    setStarting(true)
    setError(null)
    try {
      const t = await startAttempt({ assignmentId })
      setLiveDeadline(t.deadline)
      setPhase('taking')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start. Please try again.')
      setStarting(false)
    }
  }

  if (phase === 'intro') {
    return (
      <div className="feu-card" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, color: 'var(--green)' }}>Before you start</h2>
        <ul style={{ lineHeight: 1.7, color: 'var(--ink)' }}>
          <li>This is a <strong>timed</strong> assessment: you have <strong>{durationMinutes} minutes</strong>.</li>
          <li>The timer <strong>keeps running</strong> once you start — even if you close or refresh the page.</li>
          <li>When time runs out, your answers are <strong>submitted automatically</strong>.</li>
          <li>You can submit early. Answer every item before submitting.</li>
        </ul>
        {error && <p className="feu-error">{error}</p>}
        <button type="button" className="feu-btn-gold" onClick={begin} disabled={starting}>
          {starting ? 'Starting…' : `Start (${durationMinutes} min)`}
        </button>
      </div>
    )
  }

  return <TakeForm assignmentId={assignmentId} questions={questions} deadline={liveDeadline} />
}
