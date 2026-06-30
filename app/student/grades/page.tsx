import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentGrades } from '@/app/actions/getStudentData'
import { GradesList } from './GradesList'

export default async function StudentGradesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { classes } = await getStudentGrades()

  return (
    <div className="feu-page">
      <h1>Grades</h1>
      <p className="feu-page-sub">Your standing in each class. This view is read-only.</p>

      <GradesList classes={classes} />
    </div>
  )
}
