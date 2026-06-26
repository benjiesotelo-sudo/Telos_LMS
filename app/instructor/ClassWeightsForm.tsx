'use client'
import { useState, useTransition } from 'react'
import { setClassWeights } from '@/app/actions/setClassWeights'

interface ClassWeightsFormProps {
  classId: string
  wtQuiz: number
  wtPaper: number
  wtExam: number
}

export function ClassWeightsForm({ classId, wtQuiz, wtPaper, wtExam }: ClassWeightsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)

  // Store as percentage strings for display (0.30 → "30")
  const [quiz, setQuiz] = useState(() => String(Math.round(wtQuiz * 100)))
  const [paper, setPaper] = useState(() => String(Math.round(wtPaper * 100)))
  const [exam, setExam] = useState(() => String(Math.round(wtExam * 100)))

  const quizVal = Number(quiz) || 0
  const paperVal = Number(paper) || 0
  const examVal = Number(exam) || 0
  const total = quizVal + paperVal + examVal
  const sumOk = Math.abs(total - 100) < 0.1

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sumOk) {
      setStatus(`Weights must total 100% (current: ${total}%)`)
      return
    }
    startTransition(async () => {
      try {
        await setClassWeights({
          classId,
          wtQuiz:  quizVal  / 100,
          wtPaper: paperVal / 100,
          wtExam:  examVal  / 100,
        })
        setStatus('Saved')
        setTimeout(() => setStatus(null), 2000)
      } catch (e) {
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="feu-muted" style={{ fontSize: 12, margin: 0 }}>
        Quiz + Paper + Exam percentages must total 100%.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        {/* Quiz weight */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Quiz %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={quiz}
            disabled={isPending}
            onChange={(e) => { setQuiz(e.target.value); setStatus(null) }}
            style={inputStyle}
          />
        </label>

        {/* Paper/Activity weight */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Paper %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={paper}
            disabled={isPending}
            onChange={(e) => { setPaper(e.target.value); setStatus(null) }}
            style={inputStyle}
          />
        </label>

        {/* Exam weight */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Exam %</span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={exam}
            disabled={isPending}
            onChange={(e) => { setExam(e.target.value); setStatus(null) }}
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: sumOk ? 'var(--green)' : '#c0392b',
            }}
          >
            Total: {total}%
          </span>
          <button
            type="submit"
            disabled={isPending || !sumOk}
            className="feu-btn-green"
            style={{ fontSize: 13 }}
          >
            {isPending ? 'Saving…' : 'Save Weights'}
          </button>
        </div>
      </div>

      {status && (
        <p
          style={{
            fontSize: 12,
            margin: 0,
            color: status.startsWith('Error') || status.startsWith('Weights') ? '#c0392b' : 'var(--green)',
            fontWeight: 600,
          }}
        >
          {status}
        </p>
      )}
    </form>
  )
}

const inputStyle: React.CSSProperties = {
  width: 70,
  fontSize: 14,
  border: '1px solid var(--line, #e2e8e4)',
  borderRadius: 4,
  padding: '4px 8px',
  textAlign: 'right' as const,
}
