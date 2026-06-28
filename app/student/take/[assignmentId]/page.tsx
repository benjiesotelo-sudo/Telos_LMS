import { getTakePayload } from '@/app/actions/getTakePayload'
import { getAttemptStatus } from '@/app/actions/startAttempt'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TakeGate from './TakeGate'

export default async function TakePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const payload = await getTakePayload(assignmentId)

  // Check for existing graded submission AFTER window gate (getTakePayload enforces opens_at/closes_at)
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .eq('status', 'graded')
    .maybeSingle()

  if (existing) redirect(`/student/results/${existing.id}`)

  // Read-only: is this timed, and has the attempt already started? (Does NOT start it.)
  const status = await getAttemptStatus({ assignmentId })

  return (
    <div>
      <header className="feu-header">
        <div className="feu-crest">FEU</div>
        <div className="feu-inst">Far Eastern University · Manila</div>
        <h1>{payload.title}</h1>
        <p>{payload.type} · Answer every item, then Submit.</p>
      </header>
      <div className="feu-wrap">
        <TakeGate
          assignmentId={assignmentId}
          questions={payload.questions}
          timed={status.timed}
          durationMinutes={status.durationMinutes}
          started={status.started}
          deadline={status.deadline}
        />
      </div>
    </div>
  )
}
