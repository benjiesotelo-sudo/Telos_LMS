import { createClient } from '@/lib/supabase/server'

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

  return (
    <main>
      <h1>Your result</h1>
      <h2>{assessment?.title ?? 'Assessment'}</h2>
      <p>Type: {assessment?.type ?? '—'}</p>
      <p>Earned: {sub.earned ?? 0} / {sub.possible ?? 0}</p>
      <p>Score: {sub.score == null ? '—' : Number(sub.score).toFixed(2)}</p>
      <p>Status: {sub.status}</p>
    </main>
  )
}
