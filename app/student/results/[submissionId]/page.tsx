import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getRevealedAnswers } from '@/app/actions/getRevealedAnswers'

export default async function ResultsPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    return <main><p>Not signed in.</p></main>
  }

  const { data: sub } = await supabase
    .from('submissions')
    .select('id, earned, possible, score, status, assignments:assignment_id(assessment:assessment_id(title, type))')
    .eq('id', submissionId)
    .maybeSingle()

  if (!sub) {
    return <main><p>Result not found.</p></main>
  }

  const assessment = (sub as any).assignments?.assessment

  // Attempt to load revealed answers — null when gate fails (not revealed)
  let reveal: Awaited<ReturnType<typeof getRevealedAnswers>> = null
  try {
    reveal = await getRevealedAnswers({ submissionId })
  } catch {
    // Forbidden or any other error → treat as no reveal
    reveal = null
  }

  return (
    <>
      <header className="feu-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="feu-crest">T</div>
          <div>
            <p className="feu-inst">Far Eastern University</p>
            <h1>Your Result</h1>
          </div>
        </div>
      </header>
      <div className="feu-wrap">
        <div className="feu-card">
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>
            {assessment?.title ?? 'Assessment'}
          </h2>
          <p className="feu-muted" style={{ margin: '0 0 24px' }}>
            Type: {assessment?.type ?? '—'}
          </p>
          <div style={{ fontSize: 48, color: 'var(--green)', fontWeight: 700, lineHeight: 1, marginBottom: 8 }}>
            {sub.score == null ? '—' : `${Number(sub.score).toFixed(2)}%`}
          </div>
          <p style={{ margin: '0 0 8px', color: 'var(--gray)' }}>
            {sub.earned ?? 0} / {sub.possible ?? 0} points earned
          </p>
          <p style={{ margin: '0 0 24px' }}>
            Status:{' '}
            <span style={{
              fontWeight: 600,
              color: sub.status === 'graded' ? 'var(--green)' : 'var(--ink)',
            }}>
              {sub.status}
            </span>
          </p>

          {reveal && (
            <section style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                Answer Review
              </h3>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {reveal.questions.map((q, idx) => {
                  const correct = reveal!.correctAnswers[q.id]
                  const myAnswer = String(reveal!.myAnswers[q.id] ?? '—')
                  const correctValue = correct?.value ?? '—'
                  const isCorrect = myAnswer.trim().toLowerCase() === correctValue.trim().toLowerCase()
                  return (
                    <li key={q.id} style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: `1px solid ${isCorrect ? 'var(--green)' : 'var(--red, #d32f2f)'}`,
                      background: isCorrect ? 'var(--green-bg, #f0fdf4)' : 'var(--red-bg, #fef2f2)',
                    }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--ink)' }}>
                        {idx + 1}. {q.prompt}
                        {q.is_bonus && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray)', fontWeight: 400 }}>
                            (bonus)
                          </span>
                        )}
                      </p>
                      <p style={{ margin: '0 0 2px', fontSize: 14 }}>
                        <span style={{ color: 'var(--gray)' }}>Your answer: </span>
                        <span style={{ fontWeight: 600, color: isCorrect ? 'var(--green)' : 'var(--red, #d32f2f)' }}>
                          {myAnswer}
                        </span>
                        {' '}
                        {isCorrect ? '✓' : '✗'}
                      </p>
                      {!isCorrect && (
                        <p style={{ margin: 0, fontSize: 14 }}>
                          <span style={{ color: 'var(--gray)' }}>Correct answer: </span>
                          <span style={{ fontWeight: 600, color: 'var(--green)' }}>{correctValue}</span>
                        </p>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          <Link href="/student" className="feu-btn-outline">
            Back to dashboard
          </Link>
        </div>
      </div>
    </>
  )
}
