import Link from 'next/link'
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
          <Link href="/student" className="feu-btn-outline">
            Back to dashboard
          </Link>
        </div>
      </div>
    </>
  )
}
