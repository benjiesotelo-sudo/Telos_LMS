'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { submitAssessment } from '@/app/actions/submitAssessment'
import type { Question } from '@/lib/types'
import { isValidNumericInput } from '@/lib/utils/numeric'

interface Props {
  assignmentId: string
  questions: Question[]
  /** ISO deadline for a timed attempt (null = untimed). */
  deadline?: string | null
}

const STORAGE_KEY = (id: string) => `telos-take-${id}`
const DEBOUNCE_MS = 400

function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TakeForm({ assignmentId, questions, deadline = null }: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answersRef = useRef(answers)
  answersRef.current = answers
  const submittedRef = useRef(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(
    deadline ? Math.max(0, new Date(deadline).getTime() - Date.now()) : null,
  )

  // Restore saved answers on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY(assignmentId))
      if (saved) setAnswers(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [assignmentId])

  const saveAnswers = useCallback((next: Record<string, string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY(assignmentId), JSON.stringify(next)) } catch { /* ignore */ }
    }, DEBOUNCE_MS)
  }, [assignmentId])

  const handleChange = (questionId: string, value: string) => {
    const next = { ...answers, [questionId]: value }
    setAnswers(next)
    saveAnswers(next)
  }

  const doSubmit = useCallback(async (auto: boolean) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await submitAssessment({ assignmentId, answers: answersRef.current })
      try { localStorage.removeItem(STORAGE_KEY(assignmentId)) } catch { /* ignore */ }
      router.push(`/student/results/${res.submissionId}`)
    } catch (err) {
      submittedRef.current = false
      setIsSubmitting(false)
      setError(
        (auto ? 'Time is up — auto-submit failed. ' : '') +
          (err instanceof Error ? err.message : 'Submission failed. Please try again.'),
      )
    }
  }, [assignmentId, router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSubmit(false)
  }

  // Countdown + auto-submit for timed attempts.
  useEffect(() => {
    if (!deadline) return
    const end = new Date(deadline).getTime()
    const tick = () => {
      const ms = end - Date.now()
      setRemainingMs(Math.max(0, ms))
      if (ms <= 0) doSubmit(true)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [deadline, doSubmit])

  return (
    <form onSubmit={handleSubmit}>
      {remainingMs !== null && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 6,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: 15,
            border: '1px solid',
            background: remainingMs <= 60_000 ? '#fdecea' : '#f1f7f3',
            color: remainingMs <= 60_000 ? '#c0392b' : 'var(--green)',
            borderColor: remainingMs <= 60_000 ? '#c0392b' : 'var(--green)',
          }}
        >
          {remainingMs <= 0 ? 'Time is up — submitting…' : `Time remaining: ${fmtRemaining(remainingMs)}`}
        </div>
      )}
      {questions.map((q) => (
        <div key={q.id} className="feu-card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{q.prompt}</span>
            <span className="feu-muted" style={{ marginLeft: 8 }}>({q.points} pt{q.points === 1 ? '' : 's'}{q.is_bonus ? ', bonus' : ''})</span>
          </div>
          {q.kind === 'num' ? (
            <input
              type="text"
              inputMode="numeric"
              pattern={"-?\\d*"}
              className="feu-input"
              style={{ width: 200 }}
              value={answers[q.id] ?? ''}
              onChange={(e) => { if (isValidNumericInput(e.target.value)) handleChange(q.id, e.target.value) }}
              placeholder="your answer"
            />
          ) : (
            (q.options ?? []).map((opt) => (
              <label key={opt} style={{ display: 'block', margin: '5px 0', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: answers[q.id] === opt ? '#f1f7f3' : '#fff', borderColor: answers[q.id] === opt ? 'var(--green)' : 'var(--border)' }}>
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={answers[q.id] === opt}
                  onChange={() => handleChange(q.id, opt)}
                  style={{ marginRight: 8, accentColor: 'var(--gold)' }}
                />
                {opt}
              </label>
            ))
          )}
        </div>
      ))}
      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '2px solid var(--green)', padding: '14px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="submit" className="feu-btn-gold" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Submit'}
        </button>
        {error && <span className="feu-error">{error}</span>}
      </div>
    </form>
  )
}
