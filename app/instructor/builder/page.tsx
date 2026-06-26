import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listPics } from '@/app/actions/listClasses'
import { CoursePanel } from '@/app/instructor/CoursePanel'
import { ClassPanel } from '@/app/instructor/ClassPanel'

export default async function CourseBuilderPage() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) redirect('/login')

  const { data: courses } = await supabase
    .from('courses')
    .select('id, code')
    .order('created_at')

  const pics = await listPics()

  return (
    <div className="feu-page">
      <h1>Course Builder</h1>
      <p className="feu-page-sub">Create courses and class sections.</p>

      <CoursePanel />
      <ClassPanel courses={courses ?? []} pics={pics} />
    </div>
  )
}
