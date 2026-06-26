import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAssessmentKey } from '@/app/actions/getAssessmentKey'

export default async function AssessmentPreviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>
}) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { assessmentId } = await params

  let detail: Awaited<ReturnType<typeof getAssessmentKey>> | null = null
  let errorMsg: string | null = null

  try {
    detail = await getAssessmentKey({ assessmentId })
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'Unknown error'
  }

  if (!detail) {
    return (
      <div className="feu-page">
        <p style={{ marginBottom: 12 }}>
          <Link href="/instructor/assessments" style={{ color: 'var(--green)', fontSize: 13 }}>
            &larr; Assessments
          </Link>
        </p>
        <h1>Preview unavailable</h1>
        <p className="feu-muted">{errorMsg ?? 'This assessment could not be loaded.'}</p>
      </div>
    )
  }

  const { title, type, questions, answerKey } = detail

  const typeLabel: Record<string, string> = {
    quiz:     'Quiz',
    activity: 'Paper / Activity',
    exam:     'Exam',
  }

  return (
    <div className="feu-page">
      {/* Back nav */}
      <p style={{ marginBottom: 12 }}>
        <Link href="/instructor/assessments" style={{ color: 'var(--green)', fontSize: 13 }}>
          &larr; Assessments
        </Link>
      </p>

      {/* Header */}
      <section className="feu-card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, color: 'var(--green)', margin: 0 }}>{title}</h1>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--gray)',
              padding: '2px 7px',
              border: '1px solid var(--line, #e2e8e4)',
              borderRadius: 3,
            }}
          >
            {typeLabel[type] ?? type}
          </span>
        </div>
        <p className="feu-muted" style={{ fontSize: 13, margin: 0 }}>
          Answer key preview &mdash; instructor view only
        </p>
      </section>

      {/* Questions */}
      <section className="feu-card" aria-labelledby="questions-h">
        <h2 id="questions-h" style={{ fontSize: 16, marginBottom: 18, color: 'var(--green)' }}>
          Questions &amp; Correct Answers ({questions.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {questions.map((q, idx) => {
            const key = answerKey[q.id]
            return (
              <div
                key={q.id}
                style={{
                  borderBottom: idx < questions.length - 1
                    ? '1px solid var(--line, #eee)'
                    : 'none',
                  paddingBottom: idx < questions.length - 1 ? 18 : 0,
                }}
              >
                {/* Question header */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray)', minWidth: 24 }}>
                    {idx + 1}.
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                    {q.prompt}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: q.is_bonus ? 'var(--gold, #c8a000)' : 'var(--gray)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {q.is_bonus ? `+${key?.points ?? q.points} bonus` : `${key?.points ?? q.points} pt${(key?.points ?? q.points) !== 1 ? 's' : ''}`}
                  </span>
                </div>

                {/* Options (MCQ) */}
                {q.kind === 'mcq' && q.options && (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '0 0 0 32px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {q.options.map((opt) => {
                      const isCorrect = key && opt === key.value
                      return (
                        <li
                          key={opt}
                          style={{
                            fontSize: 13,
                            padding: '5px 10px',
                            borderRadius: 5,
                            border: isCorrect
                              ? '1.5px solid var(--green)'
                              : '1px solid var(--line, #e2e8e4)',
                            background: isCorrect ? 'rgba(34, 85, 56, 0.06)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {isCorrect && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.4px',
                                color: 'var(--green)',
                                background: 'rgba(34, 85, 56, 0.10)',
                                borderRadius: 3,
                                padding: '1px 5px',
                                flexShrink: 0,
                              }}
                            >
                              Correct
                            </span>
                          )}
                          {opt}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Numeric answer */}
                {q.kind === 'num' && key && (
                  <div style={{ marginLeft: 32, marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 13,
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: '1.5px solid var(--green)',
                        background: 'rgba(34, 85, 56, 0.06)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: 'var(--green)',
                          background: 'rgba(34, 85, 56, 0.10)',
                          borderRadius: 3,
                          padding: '1px 5px',
                        }}
                      >
                        Answer
                      </span>
                      {key.value}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
