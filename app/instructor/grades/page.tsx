import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubmissionsPanel, type RosterRow } from '@/app/instructor/SubmissionsPanel'
import type { ComponentType } from '@/lib/types'

export default async function GradesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: subData } = await supabase
    .from('submissions')
    .select('id, student_id, earned, possible, score, profiles:student_id(full_name), assignments:assignment_id(assessment:assessment_id(type))')
    .order('created_at', { ascending: true })

  const rows: RosterRow[] = (subData ?? []).map((s: any) => ({
    submissionId: s.id,
    studentId: s.student_id,
    studentName: s.profiles?.full_name ?? '',
    type: (s.assignments?.assessment?.type ?? 'activity') as ComponentType,
    earned: s.earned ?? 0,
    possible: s.possible ?? 0,
    score: s.score ?? null,
  }))

  return (
    <div className="feu-page">
      <h1>Grades</h1>
      <p className="feu-page-sub">Submission results and computed final grades.</p>

      <SubmissionsPanel rows={rows} />
    </div>
  )
}
