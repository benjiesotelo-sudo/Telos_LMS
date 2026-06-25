'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { submitAssessment } from '@/app/actions/submitAssessment'
import type { Question } from '@/lib/types'

interface Props {
  assignmentId: string
  questions: Question[]
}

const STORAGE_KEY = (id: string) => `telos-take-${id}`
const DEBOUNCE_MS = 400

export default function TakeForm({ assignmentId, questions }: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await submitAssessment({ assignmentId, answers })
      // Clear saved answers on successful submit
      try { localStorage.removeItem(STORAGE_KEY(assignmentId)) } catch { /* ignore */ }
      router.push(`/student/results/${res.submissionId}`)
    } catch (err) {
      setIsSubmitting(false)
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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
              onChange={(e) => handleChange(q.id, e.target.value)}
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
