import { getTakePayload } from '@/app/actions/getTakePayload'
import { submitAssessment } from '@/app/actions/submitAssessment'
import { redirect } from 'next/navigation'

export default async function TakePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  const payload = await getTakePayload(assignmentId)

  async function submit(formData: FormData) {
    'use server'
    const answers: Record<string, string> = {}
    for (const q of payload.questions) {
      const v = formData.get(q.id)
      if (typeof v === 'string') answers[q.id] = v
    }
    const res = await submitAssessment({ assignmentId, answers })
    redirect(`/student/results/${res.submissionId}`)
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>{payload.title}</h1>
      <form action={submit}>
        {payload.questions.map((q) => (
          <fieldset key={q.id} style={{ marginBottom: 16, border: 'none' }}>
            <legend>
              {q.prompt} ({q.points} pt{q.points === 1 ? '' : 's'}
              {q.is_bonus ? ', bonus' : ''})
            </legend>
            {q.kind === 'num' ? (
              <input type="number" name={q.id} step="any" />
            ) : (
              (q.options ?? []).map((opt) => (
                <label key={opt} style={{ display: 'block' }}>
                  <input type="radio" name={q.id} value={opt} /> {opt}
                </label>
              ))
            )}
          </fieldset>
        ))}
        <button type="submit">Submit</button>
      </form>
    </main>
  )
}
