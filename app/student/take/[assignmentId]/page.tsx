import { getTakePayload } from '@/app/actions/getTakePayload'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TakeForm from './TakeForm'

export default async function TakePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check for existing graded submission BEFORE rendering quiz
  const { data: existing } = await supabase
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .eq('status', 'graded')
    .maybeSingle()

  if (existing) redirect(`/student/results/${existing.id}`)

  const payload = await getTakePayload(assignmentId)

  return (
    <div>
      <header className="feu-header">
        <div className="feu-crest">FEU</div>
        <div className="feu-inst">Far Eastern University · Manila</div>
        <h1>{payload.title}</h1>
        <p>{payload.type} · Answer every item, then Submit.</p>
      </header>
      <div className="feu-wrap">
        <TakeForm assignmentId={assignmentId} questions={payload.questions} title={payload.title} />
      </div>
    </div>
  )
}
