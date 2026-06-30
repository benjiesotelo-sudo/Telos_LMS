import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStudentOverview } from '@/app/actions/getStudentData'
import { ClassesList } from './ClassesList'

export default async function StudentClassesPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { classes } = await getStudentOverview()

  return (
    <div className="feu-page">
      <h1>Classes</h1>
      <p className="feu-page-sub">Select a class to view its contents.</p>

      <ClassesList classes={classes} />
    </div>
  )
}
